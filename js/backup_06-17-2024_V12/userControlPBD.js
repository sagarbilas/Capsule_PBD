import * as THREE from "three";

export function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
}

// Function to calculate the angle between two vectors
function angleBetweenVectors_2(v1, v2) {
  // Calculate dot product
  const dotProduct = v1.x * v2.x + v1.z * v2.z;

  // Calculate magnitudes of vectors
  const magnitudeV1 = Math.sqrt(v1.x * v1.x + v1.z * v1.z);
  const magnitudeV2 = Math.sqrt(v2.x * v2.x + v2.z * v2.z);

  // Calculate angle in radians using dot product and magnitudes
  const angleRadians = Math.acos(dotProduct / ((magnitudeV1 * magnitudeV2)+0.0000001) );

  // Convert angle from radians to degrees
  const angleDegrees = angleRadians * 180 / Math.PI;

  return angleDegrees;
}


// Function to get a vector direction deviated by a certain angle from a known normalized vector
function deviateVectorByAngle(knownVector, angle) {

  // Calculate the components of the known vector
  var x = knownVector.x;
  var y = knownVector.y;
  var z = knownVector.z;

  // Calculate the new vector direction using trigonometric functions
  var newX = x * Math.cos(angle) + (1 - Math.cos(angle)) * x + Math.sin(angle) * (y - z);
  var newY = y * Math.cos(angle) + (1 - Math.cos(angle)) * y + Math.sin(angle) * (z - x);
  var newZ = z * Math.cos(angle) + (1 - Math.cos(angle)) * z + Math.sin(angle) * (x - y);

  // Return the new vector direction as a normalized vector
  var magnitude = Math.sqrt(newX * newX + newY * newY + newZ * newZ);
  return { x: newX / magnitude, y: 0, z: newZ / magnitude };
}


let closest_in_left = new THREE.Vector3();
let closest_in_right = new THREE.Vector3();
let new_point = new THREE.Vector3();
let normalized_velocity = {};

export function step(RADIUS, sceneEntities, world, scene, customParams = {}) {
  const AGENTSIZE = RADIUS * 2;
  const epsilon = 0.0001;
  let timestep = 0
  if(customParams.scenario == 'dense_torso_like')
  {
    timestep = 0.008;   // for dense torso crowd scenario
  }
  else
  {
    timestep = 0.03;
  }

  const ITERNUM = 1; // 3
  const agentLength = RADIUS;

  let C_TAU_MAX = 20;
  let C_TAO0 = 250; 
  let C_LONG_RANGE_STIFF = 0.22  ;  
  let MAX_DELTA = 0.01; 

  let angleThresholdBtwnDirectionAndNormalInDeg = 0.08; 

  let dist_tip_to_base  = 0;
  let distToActivateOrientationConstraint = 0;
  let activate_orientation  = 'false';

  // collision functions
  function rotateLineSegment(x1, y1, x2, y2, r) {
    // Calculate the center of the line segment
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    // Translate the line segment so that its center is at the origin
    const x1p = x1 - centerX;
    const y1p = y1 - centerY;
    const x2p = x2 - centerX;
    const y2p = y2 - centerY;

    // Rotate the line segment about the origin
    const cosR = Math.cos(r);
    const sinR = Math.sin(r);
    const x1r = x1p * cosR - y1p * sinR;
    const y1r = x1p * sinR + y1p * cosR;
    const x2r = x2p * cosR - y2p * sinR;
    const y2r = x2p * sinR + y2p * cosR;

    // Translate the line segment back to its original position
    const newX1 = x1r + centerX;
    const newY1 = y1r + centerY;
    const newX2 = x2r + centerX;
    const newY2 = y2r + centerY;

    // Return the new endpoints of the line segment
    return [newX1, newY1, newX2, newY2];
  }

  function ClosestPointOnLineSegment(A, B, Point) {
    const AB = B.clone().sub(A);
    const t = AB.clone().dot(Point.clone().sub(A)) / AB.clone().dot(AB);
    return A.clone().add(
      AB.clone().multiplyScalar(Math.min(Math.max(t, 0), 1))
    );
  }

  function PointOnLineSegment(A, B, Point) {
    const AB = B.clone().sub(A);
    const t = AB.clone().dot(Point.clone().sub(A)) / AB.clone().dot(AB);
    return A.clone().add(
        AB.clone().multiplyScalar(t)
    );
  }

  function is_colliding_torso(x11, y11, x12, y12, x21, y21, x22, y22) {
    return (
      segments_distance(x11, y11, x12, y12, x21, y21, x22, y22) < 2 * RADIUS
    );
  }

  function segments_distance(x11, y11, x12, y12, x21, y21, x22, y22) {
    // distance between two segments in the plane:
    // one segment is (x11, y11) to (x12, y12)
    // the other is (x21, y21) to (x22, y22)

    if (segments_intersect(x11, y11, x12, y12, x21, y21, x22, y22)) return 0;

    // try each of the 4 vertices w/the other segment
    let distances = [
      point_segment_distance(x11, y11, x21, y21, x22, y22),
      point_segment_distance(x12, y12, x21, y21, x22, y22),
      point_segment_distance(x21, y21, x11, y11, x12, y12),
      point_segment_distance(x22, y22, x11, y11, x12, y12),
    ];
    return Math.min(...distances);
  }

  function segments_intersect(x11, y11, x12, y12, x21, y21, x22, y22) {
    // whether two segments in the plane intersect:
    // one segment is (x11, y11) to (x12, y12)
    // the other is (x21, y21) to (x22, y22)

    let dx1 = x12 - x11;
    let dy1 = y12 - y11;
    let dx2 = x22 - x21;
    let dy2 = y22 - y21;

    let delta = dx2 * dy1 - dy2 * dx1;
    if (delta === 0) return false; // parallel segments

    let s = (dx1 * (y21 - y11) + dy1 * (x11 - x21)) / delta;
    let t = (dx2 * (y11 - y21) + dy2 * (x21 - x11)) / -delta;

    return 0 <= s && s <= 1 && 0 <= t && t <= 1;
  }

  function point_segment_distance(px, py, x1, y1, x2, y2) {
    let dx = x2 - x1;
    let dy = y2 - y1;

    if (dx === 0 && dy === 0) {
      // the segment's just a point
      return Math.hypot(px - x1, py - y1);
    }

    // Calculate the t that minimizes the distance.
    let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);

    // See if this represents one of the segment's
    // end points or a point in the middle.
    if (t < 0) {
      dx = px - x1;
      dy = py - y1;
    } else if (t > 1) {
      dx = px - x2;
      dy = py - y2;
    } else {
      let near_x = x1 + t * dx;
      let near_y = y1 + t * dy;
      dx = px - near_x;
      dy = py - near_y;
    }
    return Math.hypot(dx, dy);
  }


function getCapsuleBodyNormal(agent, agentLength, RADIUS, current_rotation) {

    let iCoords = rotateLineSegment(
        agent.x,
        agent.z + agentLength + RADIUS,
        agent.x,
        agent.z - agentLength - RADIUS,
        current_rotation
      );

    if(customParams.scenario==='bottleneck')
    {
       iCoords = rotateLineSegment(
        agent.z,
        agent.x + agentLength + RADIUS,
        agent.z,
        agent.x - agentLength - RADIUS,
        current_rotation
      );
    }
  
    const aa = {
      tip: new THREE.Vector3(iCoords[0], 0, iCoords[1]),
      base: new THREE.Vector3(iCoords[2], 0, iCoords[3]),
      };
      
      // Calculate the slope of the line
      const dx = aa.base.x - aa.tip.x;
      const dz = aa.base.z - aa.tip.z  ;
  
      let leng = Math.sqrt(dx*dx + dz*dz);
        
      // Generate a normal vector (-dy, dx), perpendicular to the line
      let nx = -dz / leng;  
      let nz = dx / leng;
  
      let normal_to_capsule = new THREE.Vector3(nx, 0, nz);
      agent.normal_to_capsule = normal_to_capsule;

      
      let angle_capsule_normal_and_vel = angleBetweenVectors_2(agent.normal_to_capsule, agent.normal_to_capsule_prev);

      if(angle_capsule_normal_and_vel > 20){    // forcing normal vector to capsule body to be in the capsule's facing direction. 
        agent.normal_to_capsule = agent.normal_to_capsule_prev;
      }
      agent.normal_to_capsule_prev = agent.normal_to_capsule;
      
  
    return agent.normal_to_capsule;
  }


  function findNewPositionByProjection(predict_point, cur_point, direction_vector, angle_btwn_cur_direc_and_capsule_body_normal) {

    let position_vector = {};
  
    // if(customParams.scenario == 'rectangle' )
    if(customParams.scenario == '' )
    {
      if(angle_btwn_cur_direc_and_capsule_body_normal < 90)
        {
        // get position vector from current and precidted position
          position_vector = new THREE.Vector3().subVectors(predict_point, cur_point);
        }else{
          position_vector = new THREE.Vector3().subVectors(cur_point, predict_point);
        }
    }else{
        position_vector = new THREE.Vector3().subVectors(predict_point, cur_point);
      }
  
    // Project position_vector onto w_r
    const proj = position_vector.clone().projectOnVector(direction_vector); 
    
    // Calculate new predicted positionon on w_r vector direction.
    const p_new = cur_point.clone().add(proj);
  
    return p_new;  
  }


  /*  -----------------------  */
  /*  TODO modify lines below  */
  /*  -----------------------  */


  //short-range collision constraint
  function collisionConstraint_Capsule(best_i, best_j, p_best_i, p_best_j) {
    let stif = 1.0;

    const agentCentroidDist = distance(p_best_i.x, p_best_i.z, p_best_j.x, p_best_j.z);

    const agentDist = agentCentroidDist - AGENTSIZE;
    const dir_x = (p_best_j.x - p_best_i.x) / agentCentroidDist;
    const dir_z = (p_best_j.z - p_best_i.z) / agentCentroidDist;
    const agent_i_scaler = (1 / (1 + 1)) * agentDist;
    const agent_j_scaler = (1 / (1 + 1)) * agentDist;

    if (agentDist < 0) {
      sceneEntities[i].px += stif *  agent_i_scaler * dir_x;
      sceneEntities[i].pz += stif * agent_i_scaler * dir_z;
      sceneEntities[j].px += stif * -agent_j_scaler * dir_x;
      sceneEntities[j].pz += stif * -agent_j_scaler * dir_z;
        
      sceneEntities[i].grad.dx += agent_i_scaler * dir_x;
      sceneEntities[i].grad.dz += agent_i_scaler * dir_z;
      sceneEntities[j].grad.dx += -agent_j_scaler * dir_x;
      sceneEntities[j].grad.dz += -agent_j_scaler * dir_z;
    }

    return [
      sceneEntities[i].grad.x,
      sceneEntities[i].grad.z,
        [dir_x],
        [dir_z]
    ];
  } 



  function comfortConstraint_Capsule(best_i, best_j, p_best_i, p_best_j, capsule_i, capsule_j) {
 
    //We need to use different stiffnesses for different scenarios to achieve the best results.
  let stif = 0.0;
  if(customParams.scenario == 'dense_torso_like')
  {
    if(capsule_i.index == 0 || capsule_i.index == 1)
    {
      stif = 0.045;
    }else{
      stif = 0.01;
    }
  }

  else if(customParams.scenario == 'swap_Scenario')
  {
    stif = 0.02738;    // stif = 0.0272;   0.0282;     0.0275;   0.0274;
  } else if(customParams.scenario == 'suddenStop'){
    stif = 0.011;
  }else if(customParams.scenario == 'rectangle'){
    stif = 0.045;  
  }  else if(customParams.scenario == 'narrow_hallwayTwoAgent_FaceToFace'){
    stif = 0.02547;   // .45    0.025;
  }
  
  const agentCentroidDist = distance(p_best_i.x, p_best_i.z, p_best_j.x, p_best_j.z);

  const agentDist = agentCentroidDist - AGENTSIZE;
  const dir_x = (p_best_j.x - p_best_i.x) / agentCentroidDist;
  const dir_z = (p_best_j.z - p_best_i.z) / agentCentroidDist;
  const agent_i_scaler = (1 / (1 + 1)) * agentDist;
  const agent_j_scaler = (1 / (1 + 1)) * agentDist;

  if(customParams.scenario == 'dense_torso_like'){
  if (agentDist < 0.8)  
  {
    if(capsule_i.index != 0)
    {
      capsule_i.px += stif * agent_i_scaler * -dir_x;
      capsule_i.pz += stif * agent_i_scaler * -dir_z;
          
      capsule_i.grad.dx += agent_i_scaler * -dir_x;
      capsule_i.grad.dz += agent_i_scaler * -dir_z;
    }

    if(capsule_j.index != 0)
    {
      capsule_j.px += stif * -agent_j_scaler * -dir_x;
      capsule_j.pz += stif * -agent_j_scaler * -dir_z;
          
      capsule_j.grad.dx += -agent_j_scaler * -dir_x;
      capsule_j.grad.dz += -agent_j_scaler * -dir_z;
    }
  }
  }


  if( customParams.scenario == 'narrow_hallwayTwoAgent_FaceToFace')
  {
    if (agentDist < 1.71 )   // 1.7035, 1.704
    {   
      capsule_i.px += stif * agent_i_scaler * -dir_x;
      capsule_i.pz += stif * agent_i_scaler * -dir_z;           
      capsule_i.grad.dx += agent_i_scaler * -dir_x;
      capsule_i.grad.dz += agent_i_scaler * -dir_z;

      capsule_j.px += stif * -agent_j_scaler * -dir_x;
      capsule_j.pz += stif * -agent_j_scaler * -dir_z;   
      capsule_j.grad.dx += -agent_j_scaler * -dir_x;
      capsule_j.grad.dz += -agent_j_scaler * -dir_z;
    }
  }

  if( customParams.scenario == 'swap_Scenario' )
  {
      if ( agentDist < 1.593 )      // agentDist < 1.6
      {   
        capsule_i.px += stif * agent_i_scaler * -dir_x;
        capsule_i.pz += stif * agent_i_scaler * -dir_z;           
        capsule_i.grad.dx += agent_i_scaler * -dir_x;
        capsule_i.grad.dz += agent_i_scaler * -dir_z;
  
        capsule_j.px += stif * -agent_j_scaler * -dir_x;
        capsule_j.pz += stif * -agent_j_scaler * -dir_z;   
        capsule_j.grad.dx += -agent_j_scaler * -dir_x;
        capsule_j.grad.dz += -agent_j_scaler * -dir_z;
      }
  }

  if( customParams.scenario == 'suddenStop' )
  {
    if (agentDist < 3.6 ) 
    {  
      if(capsule_i.index != 1)
      {
        capsule_i.px += stif * agent_i_scaler * -dir_x;
        capsule_i.pz += stif * agent_i_scaler * -dir_z;

        capsule_i.grad.dx += agent_i_scaler * -dir_x;
        capsule_i.grad.dz += agent_i_scaler * -dir_z;
      }

      if(capsule_j.index != 1 )
      {  
        capsule_j.px += stif * -agent_j_scaler * -dir_x;
        capsule_j.pz += stif * -agent_j_scaler * -dir_z;
            
        capsule_j.grad.dx += -agent_j_scaler * -dir_x;
        capsule_j.grad.dz += -agent_j_scaler * -dir_z;
      }

    }
  }


  if( customParams.scenario == 'rectangle' )
  { 
      if (agentDist < 1.5 )   //0.9
      { 
        capsule_i.px += stif * agent_i_scaler * -dir_x;
        capsule_i.pz += stif * agent_i_scaler * -dir_z;           
        capsule_i.grad.dx += agent_i_scaler * -dir_x;
        capsule_i.grad.dz += agent_i_scaler * -dir_z;
  
        capsule_j.px += stif * -agent_j_scaler * -dir_x;
        capsule_j.pz += stif * -agent_j_scaler * -dir_z;   
        capsule_j.grad.dx += -agent_j_scaler * -dir_x;
        capsule_j.grad.dz += -agent_j_scaler * -dir_z;
      }
  }

  return [
    sceneEntities[i].grad.x,
    sceneEntities[i].grad.z,
      [dir_x],
      [dir_z]
  ];
} 


function makeNextAgentActive( agent_index ) 
{
  i = 0;
  while (i < sceneEntities.length) 
  {
    if( i == agent_index + 1 && sceneEntities[i].agent_state == 'passive')
    {
      sceneEntities[i].agent_state = 'active';
      if( (sceneEntities[i].index == 0 || sceneEntities[i].index == 1 || sceneEntities[i].index == 2 || sceneEntities[i].index == 3 || sceneEntities[i].index == 4 || sceneEntities[i].index == 5 ) && (sceneEntities[i].agent_state == 'active') )
      {   
            sceneEntities[i].goal_x = -4;
            sceneEntities[i].goal_z = -0.1;
      }

      if( (sceneEntities[i].index == 6 || sceneEntities[i].index == 7 || sceneEntities[i].index == 8 || sceneEntities[i].index == 9 || sceneEntities[i].index == 10 || sceneEntities[i].index == 11 ) && (sceneEntities[i].agent_state == 'active') )
      {   
        sceneEntities[i].goal_x = -13.8;
        sceneEntities[i].goal_z = -2.4;            
      }

    }

    i += 1;
  }
  
}




  function agentVelocityPlanner() {
    sceneEntities.forEach(function (agent_i) {
      const distToGoal = distance(
        agent_i.x,
        agent_i.z,
        agent_i.goal_x,
        agent_i.goal_z
      );
      if (distToGoal > RADIUS) {
        const dir_x = (agent_i.goal_x - agent_i.x) / distToGoal;
        const dir_z = (agent_i.goal_z - agent_i.z) / distToGoal;

        agent_i.vx = agent_i.v_pref * dir_x;
        agent_i.vz = agent_i.v_pref * dir_z;
      }
      agent_i.vx = 0.9999 * agent_i.vx;
      agent_i.vz = 0.9999 * agent_i.vz;

    if(customParams.scenario == 'dense_torso_like' )
    {
      // ---------- for Torso Dense Crowd -------  START -----------------------------------------------
        // if(distToGoal < 5 * RADIUS)
        if(distToGoal < 3 * RADIUS && agent_i.index != 0)
          {
            agent_i.vx = 0.01 * agent_i.vx;
            agent_i.vz = 0.01 * agent_i.vz;        
          }
        //----------- for Torso Dense Crowd ------- END ----------------------------------------------
    }

     
    });
  }

  function clamp2D(vx,vy, maxValue) {
    const lengthV = Math.sqrt(vx * vx + vy * vy);
    if (lengthV > maxValue) {
      const mult = (maxValue / lengthV);
      vx *= mult;
      vy *= mult;
    }
    return {"x":vx, "y":vy}
  }

 
  //**************************************************** START ************************************************************ */
  // long-range collision avoidance for capsule shape.
  function longRangeConstraintCapsule(best_i, best_j,
                                      p_best_i, p_best_j,
                                      theta_i, theta_j,
                                      agent_i, agent_j,
                                      entity_i, entity_j,
                                      i = -1, j = -1) {

    const agentCentroidDist = distance(p_best_i.x, p_best_i.z, p_best_j.x, p_best_j.z);

    const radius_init = 2 * AGENTSIZE;
    const radius_sq_init = radius_init * radius_init;
    let radius_sq = radius_sq_init;
    const dv_i = 1.;  // 1./delta_t;
    let delta_correction_i = {"x":0, "y":0};
    let delta_correction_j= {"x":0, "y":0};
    if (agentCentroidDist < radius_init) {
      radius_sq = (radius_init - agentCentroidDist) * (radius_init - agentCentroidDist);
    }
    const v_x = (p_best_i.x - best_i.x) / timestep - (p_best_j.x - best_j.x) / timestep;
    const v_y = (p_best_i.z - best_i.z) / timestep - (p_best_j.z - best_j.z) / timestep;
    const x0 = best_i.x - best_j.x;
    const y0 = best_i.z - best_j.z;
    const v_sq = v_x * v_x + v_y * v_y;
    const x0_sq = x0 * x0;
    const y0_sq = y0 * y0;
    const x_sq = x0_sq + y0_sq;
    const a = v_sq;
    const b = -v_x * x0 - v_y * y0;   // b = -1 * v_.dot(x0_).  Have to check this.
    const b_sq = b * b;
    const c = x_sq - radius_sq;
    const d_sq = b_sq - a * c;
    const d = Math.sqrt(d_sq);
    const tao = (b - d) / a;

    let lengthV;
    let grad_x_i;
    let grad_y_i;
    let grad_x_j;
    let grad_y_j;
    let s;

    if (d_sq > 0.0 && Math.abs(a) > epsilon && tao > 0 && tao < C_TAU_MAX) {
      const c_tao = Math.exp(-tao * tao / C_TAO0);  //Math.abs(tao - C_TAO0);
      const tao_sq = c_tao * c_tao;

      grad_x_i = 2 * c_tao * ((dv_i / a) * ((-2. * v_x * tao) - (x0 + (v_y * x0 * y0 + v_x * (radius_sq - y0_sq)) / d)));
      grad_y_i = 2 * c_tao * ((dv_i / a) * ((-2. * v_y * tao) - (y0 + (v_x * x0 * y0 + v_y * (radius_sq - x0_sq)) / d)));
      grad_x_j = -grad_x_i;
      grad_y_j = -grad_y_i;
      
      // special case
      // rotation (facing angle) difference
      let facingDiff = Math.abs(theta_i - theta_j);

      // best points distance difference
      let projectedPoint_j = PointOnLineSegment(agent_j.real_base, agent_j.real_tip, best_i);
      let bestPointDiff = distance(projectedPoint_j.x, projectedPoint_j.z, best_j.x, best_j.z);

      // if facing direction on the same line AND the best points are exactly facing with each other
      // adding gradient value
  
      // if (bestPointDiff <= 4.0 &&  (facingDiff < 0.015 || facingDiff - Math.PI) <0.015 ){  //used this
      if (bestPointDiff <= 6.0 &&  (facingDiff < 0.015 || facingDiff - Math.PI) <0.015 ){
        grad_y_i = signNoP(grad_y_i) * (Math.abs(grad_x_i)/1.2);   //used this
        grad_y_j = -grad_y_i;
      }
    
      const stiff = C_LONG_RANGE_STIFF * Math.exp(-tao * tao / C_TAO0);    //changed
      s = stiff * tao_sq / (0.5 * (grad_y_i * grad_y_i + grad_x_i * grad_x_i) + 0.5 * (grad_y_j * grad_y_j + grad_x_j * grad_x_j));     //changed

      delta_correction_i = clamp2D(s * 0.5 * grad_x_i,
          s * 0.5 * grad_y_i,
          MAX_DELTA);
      delta_correction_j = clamp2D(s * 0.5 * grad_x_j,
          s * 0.5 * grad_y_j,
          MAX_DELTA);
    }else {
      grad_x_i = 0;
      grad_y_i = 0;
      grad_x_j = 0;
      grad_y_j = 0;
      s=0;
    }

    // return tao;
    return [
        delta_correction_i,
        delta_correction_j,
        [grad_x_i, grad_y_i],
        [grad_x_j, grad_y_j],
        s
    ];
  }



  function rotationConstraint(capsule_entity)
  {
    let current_rotation = capsule_entity.agent.rotation.z;
  
    let NormalVectorToCapsuleBody = getCapsuleBodyNormal(capsule_entity, agentLength, RADIUS, current_rotation);
    let NormalVectorToCapsuleBodyNormalized = NormalVectorToCapsuleBody.clone().normalize();
  
    var currentPosition = new THREE.Vector3(capsule_entity.x, 0, capsule_entity.z);
    var predicted_position = new THREE.Vector3(capsule_entity.px, 0, capsule_entity.pz);
    var directionVector = predicted_position.clone().sub(currentPosition);    
    var directionVectorNormalized = directionVector.clone().normalize();
  
    let angleOfDirectionAndCapsuleBodyNormal = angleBetweenVectors_2(directionVectorNormalized, NormalVectorToCapsuleBody);
    
    //check if the angle btwn capsule body normal vector is greater than a threhold angle
    if(angleOfDirectionAndCapsuleBodyNormal > angleThresholdBtwnDirectionAndNormalInDeg )
    {  
      //calculating projected point on right side
      let angleOfDirectionAndCapsuleBodyNormal_Radians_right = angleThresholdBtwnDirectionAndNormalInDeg * (Math.PI/180);
      let rightSideDirectionVector_temp = deviateVectorByAngle(NormalVectorToCapsuleBodyNormalized, angleOfDirectionAndCapsuleBodyNormal_Radians_right);
      let rightSideDirectionVector = new THREE.Vector3(rightSideDirectionVector_temp.x, 0, rightSideDirectionVector_temp.z);
      rightSideDirectionVector = rightSideDirectionVector.clone().normalize();

      let projectedPointOnRightSide =  findNewPositionByProjection(predicted_position, currentPosition, rightSideDirectionVector, angleOfDirectionAndCapsuleBodyNormal);

      //calculating projected point on left side
      let angleOfDirectionAndCapsuleBodyNormal_Radians_Left= -angleThresholdBtwnDirectionAndNormalInDeg * (Math.PI/180);
      let leftSideDirectionVector_temp = deviateVectorByAngle(NormalVectorToCapsuleBodyNormalized, angleOfDirectionAndCapsuleBodyNormal_Radians_Left);
      let leftSideDirectionVector = new THREE.Vector3(leftSideDirectionVector_temp.x, 0, leftSideDirectionVector_temp.z);
      leftSideDirectionVector = leftSideDirectionVector.clone().normalize();

      let projectedPointOnLeftSide = findNewPositionByProjection(predicted_position, currentPosition, leftSideDirectionVector, angleOfDirectionAndCapsuleBodyNormal);

      // calculating distance btwn new predicted positions with old predicted position in left and right side of the capsule normal vector
      let distPredictedAndProjectedRightSide = distance(predicted_position.x, predicted_position.z, projectedPointOnRightSide.x, projectedPointOnRightSide.z);
      let distPredictedAndProjectedLeftSide = distance(predicted_position.x, predicted_position.z, projectedPointOnLeftSide.x, projectedPointOnLeftSide.z);
      
      //update agent position with whichever projected point has the shortest distance with old predicted position
      if(distPredictedAndProjectedLeftSide >= distPredictedAndProjectedRightSide )
      {
        capsule_entity.px = projectedPointOnRightSide.x;
        capsule_entity.pz = projectedPointOnRightSide.z;
      }
      else{
        capsule_entity.px = projectedPointOnLeftSide.x;
        capsule_entity.pz = projectedPointOnLeftSide.z;
      }
    }
  
    return { x: capsule_entity.px, y: 0, z: capsule_entity.pz };
  }


  function getBestPointWithWall(xi, zi, wall){

    const iCoords = rotateLineSegment(
        xi,
        zi + agentLength + RADIUS,
        xi,
        zi - agentLength - RADIUS,
        sceneEntities[i].agent.rotation.z
    );

    // Agent A
    const a = {
      tip: new THREE.Vector3(iCoords[0], 0, iCoords[1]),
      base: new THREE.Vector3(iCoords[2], 0, iCoords[3]),
      radius: RADIUS,
    };
    
    // Wall B
    const b = {
      tip: new THREE.Vector3(wall.tip.x, 0, wall.tip.z),
      base: new THREE.Vector3(wall.base.x, 0, wall.base.z),
      radius: RADIUS,
    };

  
    // Calculate the slope of the line
    const dx = a.base.x - a.tip.x;
    const dz = a.base.z - a.tip.z  ;
    
    let leng = Math.sqrt(dx*dx + dz*dz);
        
    dist_tip_to_base = leng;

    // capsule A:
    const a_Normal = a.tip.clone().sub(a.base.clone()).normalize();
    const a_LineEndOffset = a_Normal.clone().multiplyScalar(a.radius);
    const a_A = a.base.clone().add(a_LineEndOffset);
    const a_B = a.tip.clone().sub(a_LineEndOffset);

    // capsule B:
    const b_Normal = b.tip.clone().sub(b.base.clone()).normalize();
    const b_LineEndOffset = b_Normal.clone().multiplyScalar(b.radius);
    const b_A = b.base.clone().add(b_LineEndOffset);
    const b_B = b.tip.clone().sub(b_LineEndOffset);

    // vectors between line endpoints:
    const v0 = b_A.clone().sub(a_A);
    const v1 = b_B.clone().sub(a_A);
    const v2 = b_A.clone().sub(a_B);
    const v3 = b_B.clone().sub(a_B);

    // squared distances:
    const d0 = v0.clone().dot(v0);
    const d1 = v1.clone().dot(v1);
    const d2 = v2.clone().dot(v2);
    const d3 = v3.clone().dot(v3);

    // select best potential endpoint on capsule A:
    let bestA;
    if (d2 < d0 || d2 < d1 || d3 < d0 || d3 < d1) {
      bestA = a_B;
    } else {
      bestA = a_A;
    }

    // select point on capsule B line segment nearest to best potential endpoint on A capsule:
    const bestB = ClosestPointOnLineSegment(b_A, b_B, bestA);

    // now do the same for capsule A segment:
    bestA = ClosestPointOnLineSegment(a_A, a_B, bestB);

    return [bestA, bestB, a, b]
  }



  function getBestPoint(xi, zi, xj, zj){

    const iCoords = rotateLineSegment(
        xi,
        zi + agentLength + RADIUS,
        xi,
        zi - agentLength - RADIUS,
        sceneEntities[i].agent.rotation.z
    );

    const jCoords = rotateLineSegment(
        xj,
        zj + agentLength + RADIUS,
        xj,
        zj - agentLength - RADIUS,
        sceneEntities[j].agent.rotation.z
    );


    // Agent A
    const a = {
      tip: new THREE.Vector3(iCoords[0], 0, iCoords[1]),
      base: new THREE.Vector3(iCoords[2], 0, iCoords[3]),
      radius: RADIUS,
      real_tip: null,
      real_base: null
    };
    // Agent B
    const b = {
      tip: new THREE.Vector3(jCoords[0], 0, jCoords[1]),
      base: new THREE.Vector3(jCoords[2], 0, jCoords[3]),
      radius: RADIUS,
      real_tip: null,
      real_base: null
    };

    // Calculate the slope of the line
    const dx = a.base.x - a.tip.x;
    const dz = a.base.z - a.tip.z  ;
        
    let leng = Math.sqrt(dx*dx + dz*dz);
    dist_tip_to_base = leng;

    // capsule A:
    const a_Normal = a.tip.clone().sub(a.base.clone()).normalize();
    const a_LineEndOffset = a_Normal.clone().multiplyScalar(a.radius);
    const a_A = a.base.clone().add(a_LineEndOffset);
    const a_B = a.tip.clone().sub(a_LineEndOffset);
    a.real_tip = a_B;
    a.real_base = a_A;

    // capsule B:
    const b_Normal = b.tip.clone().sub(b.base.clone()).normalize();
    const b_LineEndOffset = b_Normal.clone().multiplyScalar(b.radius);
    const b_A = b.base.clone().add(b_LineEndOffset);
    const b_B = b.tip.clone().sub(b_LineEndOffset);
    b.real_tip = b_B;
    b.real_base = b_A;

    // vectors between line endpoints:
    const v0 = b_A.clone().sub(a_A);
    const v1 = b_B.clone().sub(a_A);
    const v2 = b_A.clone().sub(a_B);
    const v3 = b_B.clone().sub(a_B);

    // squared distances:
    const d0 = v0.clone().dot(v0);
    const d1 = v1.clone().dot(v1);
    const d2 = v2.clone().dot(v2);
    const d3 = v3.clone().dot(v3);

    // select best potential endpoint on capsule A:
    let bestA;
    if (d2 < d0 || d2 < d1 || d3 < d0 || d3 < d1) {
      bestA = a_B;
    } else {
      bestA = a_A;
    }

    // select point on capsule B line segment nearest to best potential endpoint on A capsule:
    const bestB = ClosestPointOnLineSegment(b_A, b_B, bestA);

    // now do the same for capsule A segment:
    bestA = ClosestPointOnLineSegment(a_A, a_B, bestB);

    return [bestA, bestB, a, b]
  }



  function dotProduct(vector1, vector2) {
    let result = 0;
    for (let i = 0; i < vector1.length; i++) {
      result += vector1[i] * vector2[i];
    }
    return result;
  }

  function areCollinear(vector1, vector2) {
    // Ensure vectors are of the same dimension
    if (vector1.length !== vector2.length) {
      return false;
    }

    // Find the ratio of the first non-zero pair of elements
    let ratio;
    for (let i = 0; i < vector1.length; i++) {
      if (vector1[i] !== 0 && vector2[i] !== 0) {
        ratio = vector1[i] / vector2[i];
        break;
      }
    }

    // Check if all corresponding elements are in the same ratio
    for (let i = 0; i < vector1.length; i++) {
      // Handle division by zero cases
      if (vector1[i] === 0 && vector2[i] !== 0 || vector1[i] !== 0 && vector2[i] === 0) {
        return false;
      }

      // Check the ratio
      if (vector1[i] !== 0 && vector2[i] !== 0) {
        if (vector1[i] / vector2[i] !== ratio) {
          return false;
        }
      }
    }

    return true;
  }

  function signNoP(n){
    if (n >= 0){
      return 1;
    }else {
      return -1;
    }

  }



  function find_best_point_On_right_or_Left_of_Velocity(capsule_entity, capsule_or_wall_entity, agents_pair_type)
  {
    let bestA_agent = new THREE.Vector3();
    let bestB_other_agent_or_wall = new THREE.Vector3();

    let cur_pos = new THREE.Vector3(capsule_entity.x, 0, capsule_entity.z);
    normalized_velocity = new THREE.Vector3(sceneEntities[i].vx, 0, sceneEntities[i].vz).normalize();
    let threshold_Dist = 0.5;
    
    // Calculate the new position
    const displacement = normalized_velocity.clone().multiplyScalar(threshold_Dist);
    new_point = cur_pos.clone().add(displacement);
    
    if( agents_pair_type == "agents_only" )
    {
      [bestA_agent, bestB_other_agent_or_wall, , ] = getBestPoint(capsule_entity.x, capsule_entity.z, capsule_or_wall_entity.x, capsule_or_wall_entity.z);  // getting best points in other agents.
    }
    else if(agents_pair_type == "agents_and_walls")
    {
      [bestA_agent, bestB_other_agent_or_wall, , ] = getBestPointWithWall(capsule_entity.x, capsule_entity.z, capsule_or_wall_entity);     // getting best points in the walls.
    }
   
  return [bestA_agent, bestB_other_agent_or_wall]
}
  
  
  // function compute_Shortest_Perpendicular_dist(closest_in_left_or_right, new_point, normalized_velocity_2)
  function compute_Shortest_Perpendicular_dist(closest_in_left_or_right, current_position, normalized_velocity_2)
  {
    // Calculate the vector from the line origin to the point in question
    const originToPoint = new THREE.Vector3().subVectors(closest_in_left_or_right, current_position);

    // Project this vector onto the direction vector of the line
    const projection = normalized_velocity_2.clone().multiplyScalar(originToPoint.dot(normalized_velocity_2));

    // Calculate the perpendicular vector from the point to the line
    const perpendicularVector = new THREE.Vector3().subVectors(originToPoint, projection);

    // The length of this perpendicular vector is the distance from the point to the line
    let perpendicularDistance_right_or_left = perpendicularVector.length();
  
  return perpendicularDistance_right_or_left;
  }


  // function computerClearanceForAgent(capsule_entity, normalized_velocity_2, closest_in_right, closest_in_left)
  function computerClearanceForAgent(capsule_entity, normalized_velocity_2, closest_in_right, closest_in_left, object_type_in_both_sides)
  {
    let perpendicularDistance_right = 0;
    let perpendicularDistance_left = 0;
    let clearance = 0;

    let closest_in_right_2 = new THREE.Vector3(closest_in_right.x, 0, closest_in_right.z);
    let closest_in_left_2 = new THREE.Vector3(closest_in_left.x, 0, closest_in_left.z);

    let current_position = new THREE.Vector3(capsule_entity.x, 0, capsule_entity.z);    

    if(closest_in_right_2.length() != 0)
    {
      perpendicularDistance_right = compute_Shortest_Perpendicular_dist(closest_in_right_2, current_position, normalized_velocity_2);   
    }

    if(closest_in_left_2.length() != 0)
    {
      perpendicularDistance_left = compute_Shortest_Perpendicular_dist(closest_in_left_2, current_position, normalized_velocity_2);
    }

    if(object_type_in_both_sides == 'wall_and_agents')
    {
      clearance = perpendicularDistance_right + perpendicularDistance_left - capsule_entity.radius;   
    } else 
      {
        clearance = perpendicularDistance_right + perpendicularDistance_left - capsule_entity.radius ;
      }
      
  return clearance;
  }


  function orientationConstraint(capsule, clearance, distToActivateOrientationConstraint, activate_orientation)
  { 
    let cross_width = (dist_tip_to_base/2) + RADIUS;

    if( (clearance) >= (2 * cross_width) && (activate_orientation=='true') )
    {
    }else if( ((clearance) < (2 * cross_width )) && ( clearance - capsule.radius > 0) && (activate_orientation=='true') )
    {
      let cosValue = ( (clearance -  capsule.radius) / ( 2 * cross_width ));
      const angleInRadians = Math.acos(cosValue);

      //smooth the rotation while changing orientation
      if( Math.abs(capsule.agent.rotation.z - angleInRadians) >= 0.08)
      {
        // Using different rotation speed to achieve the best results for different scenarios. 
        if(customParams.scenario == 'dense_torso_like')
        {
          capsule.agent.rotation.z = capsule.agent.rotation.z + angleInRadians/200;
        }else if(customParams.scenario == 'narrow_hallwayTwoAgent_FaceToFace'){
          capsule.agent.rotation.z = capsule.agent.rotation.z + angleInRadians/100;
        }else{
          capsule.agent.rotation.z = capsule.agent.rotation.z + angleInRadians/150;
        }    
      } 
    }
      else if(  (clearance - capsule.radius <= 0) && (activate_orientation=='true') )
      {
        // if no clearace available, agent needs to do 90 degree side-stepping.
        if( capsule.agent.rotation.z < 3.2)
        {
          capsule.agent.rotation.z = capsule.agent.rotation.z + 1.57/75;
        } 

      }
      else{
        }
  }


  function findClosestLeftOrRightPointOfVel(capsule_entity, point_on_obs)
  {
    let cur_position = new THREE.Vector3(capsule_entity.x, 0, capsule_entity.z);
    let vel_direction = new THREE.Vector3(capsule_entity.vx, 0, capsule_entity.vz).normalize();
    
    // Create vector from capsule position to the point
    const vectorToPoint = new THREE.Vector3().subVectors(point_on_obs, cur_position);    

    // Rotate the velocity vector by 90 degrees in the 2D plane to get the perpendicular vector
    const perpendicularVector = new THREE.Vector3(-vel_direction.z, 0, vel_direction.x);

    // Compute the dot product
    const dotProduct = perpendicularVector.dot(vectorToPoint);

    // Determine if the point is to the left or right of the velocity vector.
    const direction = dotProduct > 0 ? 'right' : 'left';

    if(direction == 'right')
    {
      let best_in_right_agent = point_on_obs;

      let cur_to_best_agent_dist_right = distance(capsule_entity.x, capsule_entity.z, best_in_right_agent.x, best_in_right_agent.z);
      if(cur_to_best_agent_dist_right <= capsule_entity.prev_cur_to_best_agent_dist_right  )
      {
        capsule_entity.closest_agent_in_right = best_in_right_agent;
        capsule_entity.prev_cur_to_best_agent_dist_right = cur_to_best_agent_dist_right;
      }
      // capsule_entity.prev_cur_to_best_agent_dist_right = cur_to_best_agent_dist_right;

      return [capsule_entity.closest_agent_in_right, direction]
    }
    
    if(direction == 'left')             
    {
      let best_in_left_agent = point_on_obs;

      let cur_to_best_agent_dist_left = distance(capsule_entity.x, capsule_entity.z, best_in_left_agent.x, best_in_left_agent.z);
      if(cur_to_best_agent_dist_left <= capsule_entity.prev_cur_to_best_agent_dist_left  )
      {
        capsule_entity.closest_agent_in_left = best_in_left_agent;

        capsule_entity.prev_cur_to_best_agent_dist_left = cur_to_best_agent_dist_left;
      }
      // capsule_entity.prev_cur_to_best_agent_dist_left = cur_to_best_agent_dist_left;

      return [capsule_entity.closest_agent_in_left, direction]
    }    
  
  }



    function findClosestLeftOrRightWALLPointOfVel_v2(capsule_entity)
    {
      j = 0;  
      let point_on_obs = new THREE.Vector3();
  
      //only if the scenario has walls
      while(j<customParams.wallData.length)
      {
        //find the closest wall right/left of agent i
        let [bestA_point_of_agent, bestB_point_of_wall] = find_best_point_On_right_or_Left_of_Velocity(sceneEntities[capsule_entity.index], customParams.wallData[j], "agents_and_walls");
        point_on_obs = new THREE.Vector3(bestB_point_of_wall.x, 0, bestB_point_of_wall.z);
  
        let cur_position = new THREE.Vector3(capsule_entity.x, 0, capsule_entity.z);
        let vel_direction = new THREE.Vector3(capsule_entity.vx, 0, capsule_entity.vz).normalize();
        
        // Create vector from capsule position to the point
        const vectorToPoint = new THREE.Vector3().subVectors(point_on_obs, cur_position);    
    
        // Rotate the velocity vector by 90 degrees in the 2D plane to get the perpendicular vector
        const perpendicularVector = new THREE.Vector3(-vel_direction.z, 0, vel_direction.x);
    
        // Compute the dot product
        const dotProduct = perpendicularVector.dot(vectorToPoint);
    
        // Determine if the point is to the left or right of the velocity vector.
        const direction = dotProduct > 0 ? 'right' : 'left';
    
        if(direction == 'right')
        {
          let best_in_right_wall = point_on_obs;
    
          let cur_to_best_wall_dist_right = distance(capsule_entity.x, capsule_entity.z, best_in_right_wall.x, best_in_right_wall.z);
    
          if(cur_to_best_wall_dist_right <= capsule_entity.prev_cur_to_best_wall_dist_right  )
          {
            capsule_entity.closest_wall_in_right = best_in_right_wall;
            capsule_entity.prev_cur_to_best_wall_dist_right = cur_to_best_wall_dist_right;
          }
        }
        
        if(direction == 'left')             
        {
          let best_in_left_wall = point_on_obs;
          let cur_to_best_wall_dist_left = distance(capsule_entity.x, capsule_entity.z, best_in_left_wall.x, best_in_left_wall.z);
    
          if(cur_to_best_wall_dist_left <= capsule_entity.prev_cur_to_best_wall_dist_left  )
          {
            capsule_entity.closest_wall_in_left = best_in_left_wall;
            capsule_entity.prev_cur_to_best_wall_dist_left = cur_to_best_wall_dist_left;
          }
        }
    
      j += 1;
      }
      
      return [capsule_entity.closest_wall_in_left, capsule_entity.closest_wall_in_right]
    }


function findFinalClosestLeftOrRightPointOfVel(capsule_entity, closest_wall_in_left, closest_wall_in_right, closest_agent_in_left, closest_agent_in_right)
{
    
// if there are walls in the scenarios either in left or right side of agent i. else the closest points in right and left could be other agents or obstacles. Below we are deciding that.
if(closest_wall_in_left.length() != 0 && closest_wall_in_right.length() != 0)   
{
    
    let cur_to_closest_left_wall_dist = distance(capsule_entity.x, capsule_entity.z, closest_wall_in_left.x,closest_wall_in_left.z);
    let cur_to_closest_left_agent_dist = distance(capsule_entity.x, capsule_entity.z, closest_agent_in_left.x, closest_agent_in_left.z);

    let cur_to_closest_right_wall_dist = distance(capsule_entity.x, capsule_entity.z, closest_wall_in_right.x, closest_wall_in_right.z);
    let cur_to_closest_right_agent_dist = distance(capsule_entity.x, capsule_entity.z, closest_agent_in_right.x, closest_agent_in_right.z);

    // if there are no agent in the left side, the closer left wall is the closest_in_left
    if( closest_agent_in_left.length() != 0)
    { 
      if(cur_to_closest_left_wall_dist >= cur_to_closest_left_agent_dist)
      {
        closest_in_left = closest_agent_in_left;
      }else{
          closest_in_left = closest_wall_in_left;
        }
    }else{
      closest_in_left = closest_wall_in_left;
    }

    // if there are no agent in the right side, the closer right wall is the closest_in_right
    if( closest_agent_in_right.length() != 0)
    {      
      if(cur_to_closest_right_wall_dist >= cur_to_closest_right_agent_dist)
      {
          closest_in_right = closest_agent_in_right;
        }else{
          {
            closest_in_right = closest_wall_in_right;
          }
      }
    }else{
      closest_in_right = closest_wall_in_right;
    }

  }
  else{
    closest_in_left = closest_agent_in_left;                        // else the closest points in right and left would be other agents
    closest_in_right = closest_agent_in_right;
  }
  
  let dist_with_closest_in_left = distance(capsule_entity.x, capsule_entity.z, closest_in_left.x, closest_in_left.z);
  let dist_with_closest_in_right = distance(capsule_entity.x, capsule_entity.z, closest_in_right.x, closest_in_right.z);
  let dist_with_closest_in_right_And_left = distance(closest_in_left.x, closest_in_left.z, closest_in_right.x, closest_in_right.z);
  let activate_orietation = 'false';
  let cross_width = (dist_tip_to_base/2) + RADIUS;
  
  // different threshold distances for work best in different scenarios. This activates when to start rptation to go through narrow exits. 
  if(customParams.scenario == 'suddenStop')
  {
    if( (dist_with_closest_in_left <= (cross_width+5) || dist_with_closest_in_right <= (cross_width+5))  )
      {
        activate_orietation = 'true'; 
      }else{
        activate_orietation = 'false'; 
      }
  }
  else if( customParams.scenario == 'rectangle')
  {
    if( (dist_with_closest_in_left <= (cross_width+15) || dist_with_closest_in_right <= (cross_width+15)) && (dist_with_closest_in_right_And_left <= 2 * cross_width + 8 )   )
      {
        activate_orietation = 'true'; 
      }else{
        activate_orietation = 'false'; 
      }
  }
  else{
    
  if( (dist_with_closest_in_left <= (cross_width+5) || dist_with_closest_in_right <= (cross_width+5)) && (dist_with_closest_in_right_And_left <= 2 * cross_width + 3 )  )
  // if( (dist_with_closest_in_left <= (cross_width+3) || dist_with_closest_in_right <= (cross_width+3)) && (dist_with_closest_in_right_And_left <= 2 * cross_width )  )
  {
    activate_orietation = 'true'; 
  }else{
    activate_orietation = 'false'; 
  }

  }
      
return [closest_in_left,  closest_in_right, distToActivateOrientationConstraint, activate_orietation]            
}



  /*  -----------------------  */
  agentVelocityPlanner();

  sceneEntities.forEach(function (item) {
    item.px = item.x + timestep * item.vx;
    item.pz = item.z + timestep * item.vz;
    item.py = item.y + timestep * item.vy;
  });


  let pbdIters = 0;
  let isColliding;
  var agent_a,
    agent_b,
    desDistance,
    i,
    j,
    idx = 0;


  while (pbdIters < ITERNUM) {

    // clean previous accumulated gradient
    i = 0;
    while (i < sceneEntities.length) {
      j = i + 1;
      while (j < sceneEntities.length) {

        sceneEntities[i].grad.x = 0;
        sceneEntities[i].grad.z = 0;
        sceneEntities[j].grad.x = 0;
        sceneEntities[j].grad.z = 0;

        sceneEntities[i].grad.dx = 0;
        sceneEntities[i].grad.dz = 0;
        sceneEntities[j].grad.dx = 0;
        sceneEntities[j].grad.dz = 0;

        j += 1;
      }
      i += 1;
    }



// ==============================================================================
//Orientation constraint
i = 0;
while (i < sceneEntities.length) {
  let [closest_left_point_on_wall, closest_right_point_on_wall] =  findClosestLeftOrRightWALLPointOfVel_v2(sceneEntities[i]);

  sceneEntities[i].closest_wall_in_right = closest_right_point_on_wall;
  sceneEntities[i].closest_wall_in_left = closest_left_point_on_wall;

  let bestA_point_of_agent = new THREE.Vector3();
  let bestB_point_of_other_agent = new THREE.Vector3();

  // to iterate over all other agents and to find the closest agent right/left of each agents. 
  j = i+1 ;
  while (j < sceneEntities.length) {

    [bestA_point_of_agent, bestB_point_of_other_agent] = find_best_point_On_right_or_Left_of_Velocity(sceneEntities[i], sceneEntities[j], "agents_only"); 

    sceneEntities[i].point_on_obs = new THREE.Vector3(bestB_point_of_other_agent.x, 0, bestB_point_of_other_agent.z);
    sceneEntities[j].point_on_obs = new THREE.Vector3(bestA_point_of_agent.x, 0, bestA_point_of_agent.z);

    //find the closest agent right/left of agent i
    let [closest_point_of_i, letftOrRight_of_i] = findClosestLeftOrRightPointOfVel(sceneEntities[i], sceneEntities[i].point_on_obs);

    if(letftOrRight_of_i == 'right')
    {
      sceneEntities[i].closest_agent_in_right = closest_point_of_i;
    }
    
    if(letftOrRight_of_i == 'left')
    {
      sceneEntities[i].closest_agent_in_left = closest_point_of_i;
    } 

    //same as before. find the closest agent right/left of agent j
    let [closest_point_of_j, letftOrRight_of_j] = findClosestLeftOrRightPointOfVel(sceneEntities[j], sceneEntities[j].point_on_obs);

    if(letftOrRight_of_j == 'right')
    {
      sceneEntities[j].closest_agent_in_right = closest_point_of_j;
    }
      
    if(letftOrRight_of_j == 'left')
    {
      sceneEntities[j].closest_agent_in_left = closest_point_of_j;
    }    

    j += 1;
  }

  [closest_in_left,  closest_in_right, distToActivateOrientationConstraint, activate_orientation] = findFinalClosestLeftOrRightPointOfVel(sceneEntities[i], sceneEntities[i].closest_wall_in_left, sceneEntities[i].closest_wall_in_right, sceneEntities[i].closest_agent_in_left, sceneEntities[i].closest_agent_in_right);

  let normalized_velocity_2 = new THREE.Vector3(normalized_velocity.x, 0, normalized_velocity.z);
  let clearance = 0;

  if(sceneEntities[i].closest_wall_in_left.length() != 0 && sceneEntities[i].closest_wall_in_right.length() != 0)   // if there are walls in the scenarios. else the closest points in right and left could be other agents or obstacles. Below we are deciding that.
  {
    clearance = computerClearanceForAgent(sceneEntities[i], normalized_velocity_2, closest_in_right, closest_in_left, "wall_and_agents");   // compute the available clearance for the agent based on the two closest points and along the velocity direction.
  }else{
    clearance = computerClearanceForAgent(sceneEntities[i], normalized_velocity_2, closest_in_right, closest_in_left, "only_agents");   // compute the available clearance for the agent based on the two closest points and along the velocity direction.
  }
  
  if( customParams.scenario != 'swap_Scenario' )
  {
      // apply orientation constraint to adapt the 
    orientationConstraint(sceneEntities[i], clearance, distToActivateOrientationConstraint, activate_orientation);
  }else if(customParams.scenario == 'swap_Scenario')     // for swap scenario, intially all static agents are agent_state = 'passive'. So we don't want to active orientationConstraint() for the static agents. that might cause oscillations for static agents sometimes.
  {
    if(sceneEntities[i].agent_state == 'active')
    {
      orientationConstraint(sceneEntities[i], clearance, distToActivateOrientationConstraint, activate_orientation);
    }
  }

  i += 1;
}
//===============================================================================



i = 0;
while (i < sceneEntities.length) {
  j = i + 1;
  while (j < sceneEntities.length) {
      let [bestA, bestB, agent_i, agent_j] = getBestPoint(sceneEntities[i].x, sceneEntities[i].z, sceneEntities[j].x, sceneEntities[j].z);
      let [p_bestA, p_bestB, p_agent_i,p_agent_j] = getBestPoint(sceneEntities[i].px, sceneEntities[i].pz, sceneEntities[j].px, sceneEntities[j].pz);
      
      let [delta_correction_i, delta_correction_j, grad_i, grad_j, s] = comfortConstraint_Capsule(bestA, bestB, p_bestA, p_bestB, sceneEntities[i], sceneEntities[j]);

    j += 1;
  }
  i += 1;
}
//===============================================================================


  // agent to wall short-range collision constraint    
  i=0;
   while(i<sceneEntities.length)
   {
     j=0;
     while(j<customParams.wallData.length)
     {
       let [p_bestA, w_bestB, p_agent_i,p_agent_j] = getBestPointWithWall(sceneEntities[i].px, sceneEntities[i].pz, customParams.wallData[j]);

       let penetration_normal = p_bestA.clone().sub(w_bestB);
       const len = penetration_normal.length();
       penetration_normal.divideScalar(len); // normalize
       const penetration_depth = sceneEntities[i].radius + 0.50 - len ;  //0.5 is the depth of the wall

       const intersects = penetration_depth > 0;
       if (intersects) {
         sceneEntities[i].colliding = true;
          sceneEntities[i].px += penetration_normal.x * 1.0 * penetration_depth;  
         sceneEntities[i].pz += penetration_normal.z * 1.0 * penetration_depth;
       }
       j+=1;
     }
     i+=1
   }



/*
   // if( (customParams.scenario == 'rectangle' ) && (customParams.scenario != 'bottleneck'))
  // if( (customParams.scenario == 'rectangle') || (customParams.scenario == 'narrow_hallwayTwoAgent_FaceToFace' ) )
  if( (customParams.scenario == 'rectangle') || (customParams.scenario == 'narrow_hallwayTwoAgent_FaceToFace') || ( customParams.scenario == 'swap_Scenario' ) )
  {
//=========================================== our Long-range call started ======================================================================
    //Capsule to Capsule long-range collision avoidance.
    i = 0;
    while (i < sceneEntities.length) {
      j = i + 1;
      while (j < sceneEntities.length) {
        let [bestA, bestB, agent_i, agent_j] = getBestPoint(sceneEntities[i].x, sceneEntities[i].z, sceneEntities[j].x, sceneEntities[j].z);
        let [p_bestA, p_bestB, p_agent_i,p_agent_j] = getBestPoint(sceneEntities[i].px, sceneEntities[i].pz, sceneEntities[j].px, sceneEntities[j].pz);

        let [delta_correction_i, delta_correction_j, grad_i, grad_j, s] = longRangeConstraintCapsule(
            bestA, bestB,
            p_bestA, p_bestB,
            sceneEntities[i].agent.rotation.z, sceneEntities[j].agent.rotation.z,
            agent_i, agent_j,
            sceneEntities[i], sceneEntities[j],
            i, j
        );

        let long_stif = 1;

        sceneEntities[i].px += delta_correction_i.x;
        sceneEntities[i].pz += delta_correction_i.y;
        sceneEntities[j].px += delta_correction_j.x;
        sceneEntities[j].pz += delta_correction_j.y;

        // for utilities
        sceneEntities[i].grad.x += grad_i[0];
        sceneEntities[i].grad.z += grad_i[1];
        sceneEntities[j].grad.x += grad_j[0];
        sceneEntities[j].grad.z += grad_j[1];

        sceneEntities[i].grad.s = s;
        sceneEntities[j].grad.s = s;

        sceneEntities[i].grad.dx += long_stif * delta_correction_i.x;
        sceneEntities[i].grad.dz += long_stif * delta_correction_i.y;
        sceneEntities[j].grad.dx += long_stif * delta_correction_j.x;
        sceneEntities[j].grad.dz += long_stif * delta_correction_j.y;

        customParams.best[i][j] = [bestA, bestB]
        customParams.best[j][i] = [bestB, bestA]

        j += 1;
      }
      i += 1;
    }
//======================================== our Long-range call ended ===============================================================
  }
*/


  

//short range constraint.
    i = 0;
    while (i < sceneEntities.length) {
      j = i + 1;
      while (j < sceneEntities.length) {

        let [bestA, bestB, agent_i, agent_j] = getBestPoint(sceneEntities[i].x, sceneEntities[i].z, sceneEntities[j].x, sceneEntities[j].z);
        let [p_bestA, p_bestB, p_agent_i,p_agent_j] = getBestPoint(sceneEntities[i].px, sceneEntities[i].pz, sceneEntities[j].px, sceneEntities[j].pz);
        
        let [delta_correction_i, delta_correction_j, grad_i, grad_j, s] = collisionConstraint_Capsule(bestA, bestB, p_bestA, p_bestB);
        j += 1;
      }
      i += 1;
    }



/*
  //Rotation constraint
  // if(customParams.orientation === 'front')
  // if(customParams.scenario == 'rectangle' || customParams.scenario == 'suddenStop' )
  if(customParams.scenario == 'rectangle'  )
  {
    i = 0;
    while (i < sceneEntities.length) {
      
    if(customParams.tempcount > 2) //allowing to adjust capsule's facing direction to the goal direction at the beginning.
    {
      let corrected_position = rotationConstraint(sceneEntities[i]);
          
      sceneEntities[i].px = corrected_position.x;
      sceneEntities[i].pz = corrected_position.z;
    }
      
       i += 1;
     }
   }
*/


    pbdIters += 1;
  }
 

  sceneEntities.forEach(function (item) {

    const dx = item.px - item.x;
    const dz = item.pz - item.z;

    if( customParams.scenario == ''  || customParams.scenario == '')
    {
        item.agent.rotation.z = Math.atan2(dz, dx);
    }
    else 
    {
      let cur_orientation = item.agent.rotation.z;
      let  next_orientation = Math.atan2(dz, dx);
      if( Math.abs(cur_orientation - next_orientation) >= 0.0 )   // 0.0 makes the orientation better after recovering from the full body rotations.
      {
        item.agent.rotation.z = cur_orientation - cur_orientation/200;
      }
    }


  item.vx = (item.px - item.x) / timestep;
  item.vz = (item.pz - item.z) / timestep;
  item.vy = (item.py - item.y) / timestep;

  item.x = item.px;
  item.z = item.pz;
  item.y = item.py;

  if(customParams.scenario == 'suddenStop')
  {
    // if(distance(item.x, item.z, item.goal_x, item.goal_z) < 0.1)
    if(distance(item.x, item.z, item.goal_x, item.goal_z) < 0.01)
    {
      item.vx = 0;
      item.vy = 0;
      item.vz = 0;
  
      item.x = item.goal_x;
      item.z = item.goal_z;
      item.y = 0;
  
      item.agent.rotation.z = 0;
    }
  }


// ------------------------- Start------------------ For swap_Scenario  -------------------------------------------------------------------------------------------------------------
if( item.index == 0 || item.index == 6  )
  {   
    item.agent_state = 'active';      
  }

  if(customParams.scenario === 'swap_Scenario')
  {   
    if(item.agent_state != 'active')
    { 
      // item.vx = 0;
      // item.vy = 0;
      // item.vz = 0;
  
      item.x = item.goal_x;
      item.z = item.goal_z;
      item.y = 0;
    }
          
  }

  if( (customParams.scenario === 'swap_Scenario') && ((item.index == 0 || item.index == 1 || item.index == 2 || item.index == 3 || item.index == 4 || item.index == 5 )) && (item.agent_state == 'active') )
  {   
    let dist3 = distance(item.x, item.z, -4, -0.1   ); 
    if(dist3 < 1.0  )
    {
      item.goal_x = -20;
      item.goal_z = -0.8;
    }

    let dist = distance(item.x, item.z, -26, -0.8 );  
    if( dist < 6)
    {     
      item.goal_x = -30;
      item.goal_z = -22
    }
        
    let dist5 = distance(item.x, item.z, -29, -0.8 );
    if(dist5 < 10)
    {
    }
    
    if( dist5 < 9)
    {
      if(item.index == 0)
      {
        item.goal_x = -30;
        item.goal_z = -30
      }

      if(item.index == 1)
      {
        item.goal_x = -27;
        item.goal_z = -30;
      }

      if(item.index == 2)
      {
        item.goal_x = -30;
        item.goal_z = -24;
      }

      if(item.index == 3)
      {
        item.goal_x = -27;
        item.goal_z = -24;
      }

      if(item.index == 4)
      {
        item.goal_x = -30;
        item.goal_z = -18;
      }
  
      if(item.index == 5)
      {
        item.goal_x = -27;
        item.goal_z = -18;
      }
    }

  let dist2 = distance(item.x, item.z, -28, -17 );
  if( dist2 < 5 )
  {
    makeNextAgentActive(item.index );             
  }

  }

  if( (customParams.scenario === 'swap_Scenario') && ((item.index == 6 || item.index == 7 || item.index == 8 || item.index == 9 || item.index == 10 || item.index == 11 || item.index == 12 || item.index == 13 || item.index == 14 )) && (item.agent_state == 'active') )
  {
    let dist3 = distance(item.x, item.z, -13.8, -2.4 );  
    if(dist3 < 1.0  )
    {
      item.goal_x = 10;
      item.goal_z = -1.8;
    }

    let dist = distance(item.x, item.z, 6, -1.8 );  
    if( dist < 6)
    {
      item.goal_x = 7;
      item.goal_z = 25
    }
      
    let dist4 = distance(item.x, item.z, 6, -1.8 );  
    if( dist4 < 8)
    {
      if(item.index == 6)
      {
        item.goal_x = 8;
        item.goal_z = 30
      }

      if(item.index == 7)
      {
        item.goal_x = 5;
        item.goal_z = 30
      }

      if(item.index == 8)
      {
        item.goal_x = 8;
        item.goal_z = 24;
      }

      if(item.index == 9)
      {
        item.goal_x = 5;
        item.goal_z = 24;
      }

      if(item.index == 10)
      {
        item.goal_x = 8;
        item.goal_z = 18;
      }
  
      if(item.index == 11)
      {
        item.goal_x = 5;
        item.goal_z = 18;
      }
    }
        
    let dist2 = distance(item.x, item.z, 4, 16 );
    if(dist2 < 4 )
    {        
      makeNextAgentActive(item.index );  
      
    }

  }

  if( (distance(item.x, item.z, item.goal_x, item.goal_z) < 1 ) && ( item.z > 15  || item.z < -15)  )
    {
      item.vx = 0;
      item.vy = 0;
      item.vz = 0;

      item.x = item.goal_x;
      item.z = item.goal_z;
      item.y = 0;

      item.agent.rotation.z = 0;      
    }
// ------------------------- End------------------ For swap_Scenario  -------------------------------------------
 

  });

}
