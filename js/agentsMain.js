import * as THREE from "three";
import * as PHY from "simplePhysics";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

import Stats from "three/addons/libs/stats.module.js";

let renderer, scene, camera;
let world = {
  x: 80,
  z: 80,
  pause: false,
  frame:0,
  positions: {}
};
let agentData = [];
let pickableObjects = [];
let selected = [];
let mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let grid, ring;

let spotLights = {};
let topTextures = {};
let topTexture;
const RADIUS = 1;
const blueAgentMaterial = new THREE.MeshLambertMaterial({
  color: 0x0000ff,
});
const redAgentMaterial = new THREE.MeshLambertMaterial({
  color: 0xff0000,
});
const greenAgentMaterial = new THREE.MeshLambertMaterial({
  color: 0x00ff00,
});
const yellowAgentMaterial = new THREE.MeshLambertMaterial({
    color: 0xffff00,
});

const stats = new Stats();
document.body.appendChild(stats.dom);

let arrows = [];
let g_arrows = [];
let xarrows = [];
let zarrows = [];

let narrows = [];

let parameters = {
    best:[],
    wallData: [],
    tempcount : 0,
    // scenario: 'bottleneck',
    scenario: '',
    orientation: 'front',   // 'front', 'side_Step'
    loop_counter: 0,
}

const WORLDUNIT = 1
const tile = {
    w:WORLDUNIT * 2,
    h:WORLDUNIT * 2
}
let tiles = [];
let wallData = [];

// Array to store angles per frame 
const anglesOverTime = [];          // to save rotation history
let global_frame_pointer = 0;
let csvContent = '';


class Tile {

    constructor( r, c, x, y, z, cost = 1, weight = 0) {

        this.x = x;
        this.y = y;
        this.z = z;

        this.r = r;
        this.c = c;

        this.cost = cost;

        this.g = cost;
        this.h = 0;
        this.f = 0;

        this.parent = null;

        this.weight = weight
        this.FFNeighbors = []
        this.FFMoreNeighbors = []
        this.vec = {x:0, z:0}

        this.density = 0;
    }
}

function cut(){
    let world_width = world.x;
    let world_height = world.z;

    let tile_width = tile.w;
    let tile_height = tile.h;

    let Rs =   Math.floor(world_width / tile_width);
    let Cs = Math.floor(world_height / tile_height);

    if (world_width % tile_height !== 0){
        Rs += 1;
    }

    if (world_height % tile_height !== 0){
        Cs += 1;
    }

    return [Rs, Cs];
}

function gridization(){

    [rows, columns] = cut();


    const start_point = {
        x: 0 - world.x / 2,
        y: 0,
        z: 0 - world.z / 2,
    };



    for (let i = 0; i < rows; i++) {
        tiles[i] = [];



        for (let j = 0; j < columns; j++) {

            const object_position = {
                x: start_point.x + WORLDUNIT + i * tile.w,
                y: 1,
                z: start_point.z + WORLDUNIT + j * tile.h,
            };

            let cost;
            if (checkContainsTuple(obstacles, [i, j])){
                cost = obstacleCost;
            }else {
                cost = normalCost;

            }


            tiles[i][j] = new Tile(i, j, object_position.x, object_position.y, object_position.z, cost);


        }
    }

    // // set flow field
    // let columnWidth = tiles[0].length;
    // let vectors = makeFlowField();
    // // console.log(vectors);
    // for (const row of vectors) {
    //     for (const column of row){
    //         let cell = column;
    //         let x = cell.threeVec[0];
    //         let z = cell.threeVec[1];
    //         tiles[cell.r][cell.c].vec = {x:x, z:z};
    //         tiles[cell.r][cell.c].digit = cell.digit;
    //     }
    // }

    // console.log(tiles);

    // for (let i = 0; i< rows;i++){
    //     for (let j = 0; j<columns;j++){
    //         // Create a box geometry and a mesh material
    //
    //
    //         let t = tiles[i][j];
    //
    //         const geometry = new THREE.BoxGeometry(tile.w, WORLDUNIT * 2, tile.h);
    //
    //         let material;
    //         if (t.cost >= obstacleCost){
    //             material = new THREE.MeshStandardMaterial({
    //                 transparent: true,
    //                 opacity: 1.0,
    //                 color: 0x333333 // set a color to disable the transparent effect
    //             });
    //
    //
    //         }else {
    //             material = new THREE.MeshStandardMaterial({
    //                 transparent: true,
    //                 opacity: 0.0,
    //                 color: 0x00ff00 // set a color to see the transparent effect
    //             });
    //         }
    //
    //
    //         // Create a mesh by combining the geometry and the material
    //         const cube = new THREE.Mesh(geometry, material);
    //
    //         // Set the mesh's name and userData properties
    //         cube.name = "MyCube_" + i + "_" + j;
    //         cube.userData = {
    //             type: "box",
    //             x: t.x,
    //             y: t.y,
    //             z: t.z,
    //             r: t.r,
    //             c: t.c,
    //         };
    //         cube.position.set(t.x, t.y, t.z);
    //
    //
    //         if(t.cost >= obstacleCost){
    //             pickableWall.push(cube);
    //             wallData.push(cube.userData);
    //
    //         }else {
    //             pickableWalkingTiles.push(cube);
    //         }
    //
    //
    //         pickableTiles.push(cube);
    //
    //         // Add the mesh to the scene
    //         scene.add(cube);
    //
    //
    //         // break;
    //     }
    //     // break;
    // }



    // add exit grids
    // opens.forEach(function (e, index){
    //
    //     exits[index].x = tiles[e[0]][e[1]].x
    //     exits[index].z = tiles[e[0]][e[1]].z
    //
    // });
    //
}


function init() {
  // renderer
  renderer = new THREE.WebGLRenderer();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; //
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // scene
  scene = new THREE.Scene();
  // camera
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    1000
  );

  camera.position.set(-67.26, 54.07, -3.77);
  camera.rotation.order = "YXZ";
  camera.rotation.y = -1.6267;
  camera.rotation.x = -0.46;

  // controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.addEventListener("change", render);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI / 2;

  // light
  const light = new THREE.PointLight(0xffffff, 0.9, 0, 100000);
  light.position.set(0, 50, 120);
  light.castShadow = true;
  light.shadow.mapSize.width = 512; // default
  light.shadow.mapSize.height = 512; // default
  light.shadow.camera.near = 0.5; // default
  light.shadow.camera.far = 5000; // default

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.castShadow = true;
  directionalLight.position.set(-5, 20, 4);
  directionalLight.target.position.set(9, 0, -9);
  directionalLight.shadow.camera.left *= 9;
  directionalLight.shadow.camera.right *= 9;
  directionalLight.shadow.camera.top *= 9;
  directionalLight.shadow.camera.bottom *= 9;

  scene.add(directionalLight);

  // axes
  scene.add(new THREE.AxesHelper(40));
  const loader = new THREE.TextureLoader();
  const texture = loader.load("resources/OIP.jpg");
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  const repeats = 40 / 32;
  texture.repeat.set(repeats, repeats);

  topTexture = loader.load("resources/triangle2.png");
  //topTexture.wrapS = THREE.RepeatWrapping;
  //topTexture.wrapT = THREE.RepeatWrapping;
  topTexture.magFilter = THREE.NearestFilter;
  topTexture.repeat.set(3, 3);
  //topTexture.rotation = -Math.PI / 2;
  // grid
  const geometry = new THREE.PlaneGeometry(world.x, world.z, 10, 10);
  const material = new THREE.MeshPhongMaterial({
    map: texture,
    //side: THREE.DoubleSide,
  });
  grid = new THREE.Mesh(geometry, material);
  grid.castShadow = true; //default is false
  grid.receiveShadow = true; //default
  grid.rotation.order = "YXZ";
  grid.rotation.y = -Math.PI / 2;
  grid.rotation.x = -Math.PI / 2;
  scene.add(grid);

  // experiment border
  // const boxGeometry1 = new THREE.BoxGeometry(50, 5, 1);
  // const boxMaterial1 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
  // const left = new THREE.Mesh(boxGeometry1, boxMaterial1);
  // left.position.set(0, 2.5, -25);
  //
  // const boxGeometry2 = new THREE.BoxGeometry(1, 5, 50);
  // const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
  // const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
  // bottom.position.set(-25, 2.5, 0);
  //
  // const boxGeometry3 = new THREE.BoxGeometry(1, 5, 50);
  // const boxMaterial3 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
  // const top = new THREE.Mesh(boxGeometry3, boxMaterial3);
  // top.position.set(25, 2.5, 0);
  //
  // const boxGeometry4 = new THREE.BoxGeometry(50, 5, 1);
  // const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
  // const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
  // right.position.set(0, 2.5, 25);
  //
  // scene.add(left);
  // scene.add(bottom);
  // scene.add(top);
  // scene.add(right);



  const ringGeometry = new THREE.RingGeometry(1, 3, 12);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
  });
  ring = new THREE.Mesh(ringGeometry, ringMaterial);
  scene.add(ring);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y += 0.01;


  function sampleCirclePointsWithDistance(sampleCount, distanceBetweenPoints, centerX, centerY) {
    // Calculating the total circumference that would fit the points with the given distance
    let totalCircumference = distanceBetweenPoints * sampleCount;

    // Updating the radius based on the new circumference
    let radius = totalCircumference / (2 * Math.PI);

    let points = [];
    for (let i = 0; i < sampleCount; i++) {
      // Angle in radians
      let angle = 2 * Math.PI * i / sampleCount;

      // Calculating x and y coordinates
      let x = centerX + radius * Math.cos(angle);
      let y = centerY + radius * Math.sin(angle);

      points.push({ x: x, y: y });
    }
    return points;
  }



  function testScenario(){
    addColumnAgentGroup(
        agentData,
        1,
        RADIUS * 4,
        {
          x: 20,
          z: 0,
        },
        {
          x: -20,
          z: -5,
        },
        0.8,
        "X"
    );

    addColumnAgentGroup(
        agentData,
        1,
        RADIUS * 4,
        {
          x: -20,
          z: 0,
        },
        {
          x: 20,
          z: 0,
        },
        0.8,
        "X"
    );
  }

  function testHallwayScenario(){

    for(let i=0;i<1;i++){
      addColumnAgentGroup(
          agentData,
          1,
          RADIUS * 1.5,
          {
            x: 20 ,
            z: 0 + i * 6,
          },
          {
            x: -20,
            z: 0 + i * 6,
          },
          0.8,
          "X"
      );

      addColumnAgentGroup(
          agentData,
          1,
          RADIUS * 4,
          {
            x: -20,
            z: 0 + i * 6 - 2
          },
          {
            x: 20,
            z: 0 + i * 6  - 2
          },
          0.8,
          "X"
      );


    }


  }

  function testCrossScenario(){
    addColumnAgentGroup(
        agentData,
        1,
        RADIUS * 4,
        {
          x: 20,
          z: 0,
        },
        {
          x: -20,
          z: -5,
        },
        0.8,
        "X"
    );

    addColumnAgentGroup(
        agentData,
        1,
        RADIUS * 4,
        {
          x: 0,
          z: 20,
        },
        {
          x: 0,
          z: -20,
        },
        0.8,
        "X"
    );
  }
  function testCrossWithDiagnoScenario(){
    addColumnAgentGroup(
        agentData,
        1,
        RADIUS * 4,
        {
          x: 20,
          z: 0,
        },
        {
          x: -20,
          z: -5,
        },
        0.8,
        "X"
    );

    addColumnAgentGroup(
        agentData,
        1,
        RADIUS * 4,
        {
          x: -10,
          z: 10,
        },
        {
          x: 20,
          z: -20,
        },
        0.8,
        "X"
    );
  }

  function defaultScenario(){
    addColumnAgentGroup(
        agentData,
        50,
        RADIUS * 4,
        {
          x: 0,
          z: 0,
        },
        {
          x: -10,
          z: 10,
        },
        0.8,
        "X"
    );

  }

function sampleCirclePoints(radius, sampleCount, centerX, centerY) {
    let points = [];
    for (let i = 0; i < sampleCount; i++) {
      // Angle in radians
      let angle = 2 * Math.PI * i / sampleCount;

      // Calculating x and y coordinates
      let x = centerX + radius * Math.cos(angle);
      let y = centerY + radius * Math.sin(angle);

      points.push({ x: x, y: y });
    }
    return points;
  }


function circleScenario(){

// Use below values for that scenario.
/*
  const C_LONG_RANGE_STIFF = 0.25;  
  const MAX_DELTA = 0.03;

  const C_LONG_RANGE_STIFF = 0.15;  
  const MAX_DELTA = 0.01;

  let angleThresholdBtwnDirectionAndNormalInDeg = 0.30; 
*/

    let points = sampleCirclePoints(20, 10, 0, 0);
    // let points = sampleCirclePointsWithDistance(42, 2 * 2* RADIUS + 2, 0, 0);
    console.log(points);
    points.forEach(function (point){
      addColumnAgentGroup(
          agentData,
          1,
          0,
          {
            x: point.x,
            z: point.y,
          },
          {
            x: -point.x * 1.1 ,
            z: -point.y * 1.1 ,
          },
          0.8,
          "X"
      );
    });

  }



  function oneAgentCrossingGroup() {

    parameters.scenario = 'oneAgentCrossingGroup';

    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
          x: -10,
          z: -0.60,
      },
      {
          x: 25,
          z: -0.60,
      },
      0.8,
      "X"
  );

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
              x: 38 - i * 6,
              //x: 30,
              z: -10 + j * 6,
            },
            {
              x: -30,
              //x: -20,
              z: -10 + j * 6,
            },
            0.8,
            "X"
        );
      }
    }


  //   addColumnAgentGroup(
  //     agentData,
  //     1,
  //     RADIUS * 1.5,
  //     {
  //         x: 0,
  //         z: 15.0,
  //     },
  //     {
  //         x: 0,
  //         z: -31.50,
  //     },
  //     0.8,
  //     "X"
  // ); 
  
  
  }




  
  function oneAgentCrossingAGroupInAngle() {

    parameters.scenario = 'oneAgentCrossingAGroupInAngle';

    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
          x: 7,
          z: 10.60,
      },
      {
          x: 18,
          z: -20.60,
      },
      0.8,
      "X"
  );

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
              x: 38 - i * 6,
              //x: 30,
              z: -10 + j * 6,
            },
            {
              x: -30,
              //x: -20,
              z: -10 + j * 6,
            },
            0.8,
            "X"
        );
      }
    }
  
  
  }



  

  function crossing_Two_Groups() {

  //   addColumnAgentGroup(
  //     agentData,
  //     1,
  //     RADIUS * 1.5,
  //     {
  //         x: 7,
  //         z: 10.60,
  //     },
  //     {
  //         x: 18,
  //         z: -20.60,
  //     },
  //     0.8,
  //     "X"
  // );

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
              x: 38 - i * 6,
              //x: 30,
              z: -10 + j * 6,
            },
            {
              x: -30,
              //x: -20,
              z: -10 + j * 6,
            },
            0.8,
            "X"
        );
      }
    }



    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
              x: 5 - i * 6,
              z: 10 + j * 6,
            },
            {
              x: 30,
              z: -20 + j * 6,
            },
            0.8,
            "X"
        );
      }
    }
  
  
  }




  function bidirectionalScenario() {

    parameters.scenario = 'bidirectionalScenario';
  
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          addColumnAgentGroup(
              agentData,
              1,
              RADIUS * 1.5,
              {
                x: 25 - i * 6,
                //x: 30,
                z: -10 + j * 6,
              },
              {
                x: -38,
                //x: -20,
                z: -10 + j * 6,
              },
              0.8,
              "X"
          );
        }
      }
  
  
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          addColumnAgentGroup(
              agentData,
              1,
              RADIUS * 1.5,
              {
                x: -25 + i * 6,
                //x: 30,
                z: 5 - j * 6,
              },
              {
                x: 38,
                //x: -20,
                z: 5 - j * 6,
              },
              0.8,
              "X"
          );
        }
      }  
  
    
    }





// ---------------------------------------------------------------------------------------------------------------------------------
function narrow_hallwayOneAgent_Scenario() {

  parameters.scenario = 'narrow_hallwayOneAgent_Scenario';

  addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
          x: -25,
          z: -1.50,
      },
      {
          x: 20,
          z: -1.50,
      },
      0.8,
      "X"
  );


//   addColumnAgentGroup(
//     agentData,
//     1,
//     RADIUS * 1.5,
//     {
//         x: 10,
//         z: -11.50,
//     },
//     {
//         x: -10,
//         z: 12.50,
//     },
//     0.8,
//     "X"
// );


  // experiment border
  const boxGeometry1 = new THREE.BoxGeometry(11, 5, 1);
  const boxMaterial1 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
  const left = new THREE.Mesh(boxGeometry1, boxMaterial1);
  // left.position.set(20, 2.5, 0);
  // left.position.set(-10, 2.5, 0);
  left.position.set(-10, 2.5, 0.5);

  wallData.push({
      center: new THREE.Vector3(-10, 2.5, 0.5),
      depth: 1, // along z-axis
      width: 11, // along x-axis
      base: new THREE.Vector3(-10 - 11/2, 2.5, 0.5),
      tip: new THREE.Vector3(-10 + 11/2, 2.5, 0.5),
  });

  const boxGeometry4 = new THREE.BoxGeometry(11, 5, 1);
  const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
  const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
  // right.position.set(-30, 2.5, 0);
  // right.position.set(-10, 2.5, -4);
  right.position.set(-10, 2.5, -3.5);
  wallData.push({
      center: new THREE.Vector3(-10, 2.5, -3.5),
      depth: 1, // along z-axis
      width: 11, // along x-axis
      base: new THREE.Vector3(-10 - 11 / 2, 2.5, -3.5),
      tip: new THREE.Vector3(-10 + 11 / 2, 2.5, -3.5),
  });

  scene.add(left);
  scene.add(right);

  parameters.wallData = wallData;

  
}
//---------------------------------------------------------------------------------------


/*
function narrow_hallwayOneAgent_Scenario() {

  addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
          x: -31,
          z: -1.00,
      },
      {
          x: 20,
          z: -1.0,
      },
      0.8,
      "X"
  );

  // experiment border
  const boxGeometry1 = new THREE.BoxGeometry(31, 5, 1);
  const boxMaterial1 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
  const left = new THREE.Mesh(boxGeometry1, boxMaterial1);
  // left.position.set(20, 2.5, 0);
  // left.position.set(-10, 2.5, 0);
  left.position.set(-10, 2.5, 0.5);

  wallData.push({
      center: new THREE.Vector3(-10, 2.5, 0.5),
      depth: 1, // along z-axis
      width: 31, // along x-axis
      base: new THREE.Vector3(-10 - 31/2, 2.5, 0.5),
      tip: new THREE.Vector3(-10 + 31/2, 2.5, 0.5),
  });

  const boxGeometry4 = new THREE.BoxGeometry(31, 5, 1);
  const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
  const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
  // right.position.set(-30, 2.5, 0);
  // right.position.set(-10, 2.5, -4);
  right.position.set(-10, 2.5, -3.0);
  wallData.push({
      center: new THREE.Vector3(-10, 2.5, -3.0),
      depth: 1, // along z-axis
      width: 31, // along x-axis
      base: new THREE.Vector3(-10 - 31 / 2, 2.5, -3.0),
      tip: new THREE.Vector3(-10 + 31 / 2, 2.5, -3.0),
  });

  scene.add(left);
  scene.add(right);

  parameters.wallData = wallData;
}
//-------------------------------------------------------------
*/

// --------- start ------- For Torso Crowd-like Dense Scenario  -------------------------------------------------------------
function dense_Scenario_As_Torso_Crowd_Paper_V1() {

  parameters.scenario = 'dense_torso_like';

  addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
          x: -20,
          z: 2.00,
      },
      {
          x: 20,
          z: 2.0,
      },
      0.8,
      "X"
  );


  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -10,
        z: -2.00,
    },
    {
        x: -8,
        z: -2.0,
    },
    0.8,
    "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -10,
      z: 5.00,
  },
  {
      x: -8,
      z: 5.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -9,
      z: 0.00,
  },
  {
      x: -3,
      z: 5.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -9,
      z: -5.0,
  },
  {
      x: -3,
      z: -3.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -5,
      z: -5.0,
  },
  {
      x: 1,
      z: 1.0,
  },
  0.8,
  "X"
);

}
//--------------- end --- For Torso Crowd-like Dense Scenario------------------------------------------------------------------------




// --------- start ------- For Torso Crowd-like Dense Scenario  -------------------------------------------------------------
function dense_Scenario_As_Torso_Crowd_Paper_V2() {

  parameters.scenario = 'dense_torso_like';

  // addColumnAgentGroup(
  //     agentData,
  //     1,
  //     RADIUS * 1.5,
  //     {
  //         x: -20,
  //         z: 2.00,
  //     },
  //     {
  //         x: 20,
  //         z: 2.0,
  //     },
  //     0.8,
  //     "X"
  // );

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -20,
        z: 6.00,
    },
    {
        x: 20,
        z: 6.0,
    },
    0.8,
    "X"
);


  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -10,
        z: -2.00,
    },
    {
        x: -8,
        z: -2.0,
    },
    0.8,
    "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -10,
      z: 5.00,
  },
  {
      x: -8,
      z: 5.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -9,
      z: 0.00,
  },
  {
      x: -3,
      z: 5.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -9,
      z: -5.0,
  },
  {
      x: -3,
      z: -3.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -5,
      z: -5.0,
  },
  {
      x: 1,
      z: 1.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -5,
      z: -5.0,
  },
  {
      x: 2,
      z: -6.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -5,
      z: -5.0,
  },
  {
      x: 6,
      z: -1.5,
  },
  0.8,
  "X"
);


}
//--------------- end --- For Torso Crowd-like Dense Scenario------------------------------------------------------------------------





function debug_passive_agent_oscillations()
{

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: 8,
        z: -7.00,
    },
    {
        x: 8,
        z: -6.0,
    },
    0.8,
    "X" );

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: 4,
        z: -3.00,
    },
    {
        x: 8.5,
        z: -3.8,
    },
    0.8,
    "X" );


}




// --------- start ------- For Torso Crowd-like Dense Scenario  -------------------------------------------------------------
function dense_Scenario_As_Torso_Crowd_Paper_V3() {

  parameters.scenario = 'dense_torso_like';

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -13,
        z: 2.00,
    },
    {
        x: 12,
        z: 2.0,
    },
    0.8,
    "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 8,
      z: -7.00,
  },
  {
      x: 8,
      z: -6.0,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 6,
      z: 6.00,
  },
  {
      x: 9,
      z: 6.0,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -6,
      z: -7.00,
  },
  {
      x: -6,
      z: -6.0,
  },
  0.8,
  "X"
);

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -12,
        z: -7.00,
    },
    {
        x: -12,
        z: -6.0,
    },
    0.8,
    "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -7,
      z: -7.00,
  },
  {
      x: -7,
      z: -6.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -10,
      z: -6.00,
  },
  {
      x: -9,
      z: -6.0,
  },
  0.8,
  "X"
);

//-------------------------
//   addColumnAgentGroup(
//     agentData,
//     1,
//     RADIUS * 1.5,
//     {
//         x: -13,
//         z: 2.00,
//     },
//     {
//         x: 14,
//         z: 2.0,
//     },
//     0.8,
//     "X"
// );

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -9,
        z: -2.00,
    },
    {
        x: -8,
        z: -2.0,
    },
    0.8,
    "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -9,
      z: 5.00,
  },
  {
      x: -8,
      z: 5.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -4,
      z: 3.00,
  },
  {
      x: -3,
      z: 5.0,
  },
  0.8,
  "X"
);

//-----------
addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -5,
      z: -5.0,
  },
  {
      x: -3,
      z: -3.0,
  },
  0.8,
  "X"
);
//-----------


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -1,
      z: -1.0,
  },
  {
      x: 2,
      z: 1.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 1,
      z: -5.0,
  },
  {
      x: 2,
      z: -6.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 5,
      z: -2.0,
  },
  {
      x: 6,
      z: -1.5,
  },
  0.8,
  "X"
);

//-----------------------------------------

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 9,
      z: -3.0,
  },
  {
      x: 10,
      z: -1.5,
  },
  0.8,
  "X"
);
//--------------- new agents------------------------------------------------------------------------

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 4,
      z: 4.0,
  },
  {
      x: 4  ,
      z: 6,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 2,
      z: 0.0,
  },
  {
      x: 4  ,
      z: 2,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 5,
      z: 4.0,
  },
  {
      x: 7  ,
      z: 5,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 9,
      z: 3.0,
  },
  {
      x: 10  ,
      z: 4,
  },
  0.8,
  "X"
);

// -------------- new 2----------

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -8,
      z: 0.0,
  },
  {
      x: -6  ,
      z: 2,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -5,
      z: 0.0,
  },
  {
      x: -3  ,
      z: 1,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -1,
      z: 1-.0,
  },
  {
      x: 1  ,
      z: -3,
  },
  0.8,
  "X"
);


//-------- wall code start -------------
        // experiment border
      //   const boxGeometry1 = new THREE.BoxGeometry(31, 5, 1);
      //   const boxMaterial1 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      //   const left = new THREE.Mesh(boxGeometry1, boxMaterial1);
      //   left.position.set(20, 2.5, 0);

      //   wallData.push({
      //       center: new THREE.Vector3(20, 2.5, 0),
      //       depth: 1, // along z-axis
      //       width: 31, // along x-axis
      //       base: new THREE.Vector3(20 - 31/2, 2.5, 0),
      //       tip: new THREE.Vector3(20 + 31/2, 2.5, 0),
      //   });
      // scene.add(left);

      const boxGeometry5 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const left = new THREE.Mesh(boxGeometry5, boxMaterial5);
      left.position.set(-0, 2.5, -10);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, -10),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, -10),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, -10),
      });
       scene.add(left);


      // const boxGeometry4 = new THREE.BoxGeometry(31, 5, 1);
      // const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      // const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
      // right.position.set(-30, 2.5, 0);
      // wallData.push({
      //     center: new THREE.Vector3(-30, 2.5, 0),
      //     depth: 1, // along z-axis
      //     width: 31, // along x-axis
      //     base: new THREE.Vector3(-30 - 31 / 2, 2.5, 0),
      //     tip: new THREE.Vector3(-30 + 31 / 2, 2.5, 0),
      // });
      //  scene.add(right);

      const boxGeometry4 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
      right.position.set(-0, 2.5, 12);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, 12),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, 12),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, 12),
      });
       scene.add(right);


        const boxGeometry2 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        //bottom.position.set(-15, -12.5, 0);
        bottom.position.set(-15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(-15, 2.5, -0 + 28 / 2),
        });
        scene.add(bottom);


        const boxGeometry6 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial6 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry6, boxMaterial6);
        //bottom.position.set(-15, -12.5, 0);
        top.position.set(15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(15, 2.5, -0 + 28 / 2),
        });
        scene.add(top);

        // const boxGeometry2 = new THREE.BoxGeometry(1, 5, 50);
        // const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        // const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        // //bottom.position.set(-15, -12.5, 0);
        // bottom.position.set(-15, 2.5, -25);

        // wallData.push({
        //     center: new THREE.Vector3(-15, 2.5, -25),
        //     depth: 50, // along z-axis
        //     width: 1, // along x-axis
        //     base: new THREE.Vector3(-15, 2.5, -25 - 50/2),
        //     tip: new THREE.Vector3(-15, 2.5, -25 + 50 / 2),
        // });
        // scene.add(bottom);

/*
        const boxGeometry3 = new THREE.BoxGeometry(1, 5, 30);
        const boxMaterial3 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry3, boxMaterial3);
        top.position.set(18, 2.5, 0);
        wallData.push({
            center: new THREE.Vector3(18, 2.5, 0),
            depth: 50, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(18, 2.5, 0 - 30/2),
            tip: new THREE.Vector3(18, 2.5, 0 + 30/2),
        });
        scene.add(top);

        const boxGeometry5 = new THREE.BoxGeometry(1, 5, 30);
        const boxMaterial5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom2 = new THREE.Mesh(boxGeometry5, boxMaterial5);
        bottom2.position.set(-20, 2.5, 0);
        wallData.push({
            center: new THREE.Vector3(-20, 2.5, 0),
            depth: 50, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-20, 2.5, 0 - 30/2),
            tip: new THREE.Vector3( -20, 2.5, 0 + 30/2),
        });
        scene.add(bottom2);
*/
    
        parameters.wallData = wallData;

      

//----- wall code    end-----

}
//--------------- end --- For Torso Crowd-like Dense Scenario------------------------------------------------------------------------





// --------- start ------- For Torso Crowd-like Dense Scenario  -------------------------------------------------------------
function dense_Scenario_As_Torso_Crowd_Paper_V4() {

  parameters.scenario = 'dense_torso_like';


  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -12,
        z: 6.00,
    },
    {
        x: 11,
        z: -6.0,
    },
    0.8,
    "X"
);

  //working latest - 3
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 5; j++) {

    let x_goal = 0.0;
  
    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
      // x: 15 - i * 5.3,
      // z: 42 - j * 5.3,

      x: 11 - i * 4.3,
      z: 10 - j * 4.3,

      },
      {
      // x: x_goal,
      // z: 4,

      x: 10 - i * 4.3,
      z: 10 - j * 4.3,
      },
      0.8,
      "X"
      );

      // member.agent.rotation.z = 1.0;

      }
    }




//-------- wall code start -------------

      const boxGeometry5 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const left = new THREE.Mesh(boxGeometry5, boxMaterial5);
      left.position.set(-0, 2.5, -10);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, -10),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, -10),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, -10),
      });
       scene.add(left);

      const boxGeometry4 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
      right.position.set(-0, 2.5, 12);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, 12),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, 12),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, 12),
      });
       scene.add(right);


        const boxGeometry2 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        //bottom.position.set(-15, -12.5, 0);
        bottom.position.set(-15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(-15, 2.5, -0 + 28 / 2),
        });
        scene.add(bottom);


        const boxGeometry6 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial6 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry6, boxMaterial6);
        //bottom.position.set(-15, -12.5, 0);
        top.position.set(15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(15, 2.5, -0 + 28 / 2),
        });
        scene.add(top);

        parameters.wallData = wallData;

//----- wall code    end-----


}
//--------------- end --- For Torso Crowd-like Dense Scenario------------------------------------------------------------------------









// --------- start ------- For Torso Crowd-like Dense Scenario  -------------------------------------------------------------
function dense_Scenario_As_Torso_Crowd_Paper_V5() {

  parameters.scenario = 'dense_torso_like';

//   addColumnAgentGroup(
//     agentData,
//     1,
//     RADIUS * 1.5,
//     {
//         x: -13,
//         z: 2.00,
//     },
//     {
//         x: -12,
//         z: 2.0,
//     },
//     0.8,
//     "X"
// );

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 13,
      z: -8.00,
  },
  {
      x: -12,
      z: 9.0,
  },
  0.8,
  "X"
);


// addColumnAgentGroup(
//   agentData,
//   1,
//   RADIUS * 1.5,
//   {
//       x: 13,
//       z: 8.00,
//   },
//   {
//       x: -12,
//       z: -9.0,
//   },
//   0.8,
//   "X"
// );

//left most column ------------------------------------------------------------------

//----------------
addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -12,
      z: -8,
  },
  {
      x: -12,
      z: -6,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -9,
      z: -8,
  },
  {
      x: -8,
      z: -6,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -5,
      z: -8,
  },
  {
      x: -4,
      z: -7,
  },
  0.8,
  "X"
);
///---------------

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -1,
      z: -7.00,
  },
  {
      x: -0,
      z: -6.0,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 2,
      z: -6.00,
  },
  {
      x: 2,
      z: -6.0,
  },
  0.8,
  "X"
  );


  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: 4,
        z: -8.00,
    },
    {
        x: 2,
        z: -6.0,
    },
    0.8,
    "X"
    );

    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
          x: 6,
          z: -8.00,
      },
      {
          x: 6,
          z: -6.0,
      },
      0.8,
      "X"
      );


      addColumnAgentGroup(
        agentData,
        1,
        RADIUS * 1.5,
        {
            x: 10,
            z: -7.00,
        },
        {
            x: 10,
            z: -6.0,
        },
        0.8,
        "X"
        );
// 2nd leftmost column ------------------------------------------------------------------

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -11,
      z: -2.00,
  },
  {
      x: -11,
      z: -1.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -8.0,
      z: -2.00,
  },
  {
      x: -8.0,
      z: -1.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -5,
      z: -2.00,
  },
  {
      x: -3,
      z: -3.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -2,
      z: -2.00,
  },
  {
      x: 0.5,
      z: -1.0,
  },
  0.8,
  "X"
);
     

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 2,
      z: -2.00,
  },
  {
      x: 4,
      z: -3.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 5,
      z: -2.00,
  },
  {
      x: 7.5,
      z: -1.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 9,
      z: -2.00,
  },
  {
      x: 11.5,
      z: -3.0,
  },
  0.8,
  "X"
);



// 3rd leftmost column ------------------------------------------------------------------

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -11,
      z: 3.5,
  },
  {
      x: -11,
      z: 4.0,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -9,
      z: 3.5,
  },
  {
      x: -7,
      z: 3.5,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -6,
      z: 3.5,
  },
  {
      x: -3,
      z: 2.5,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -3,
      z: 3.5,
  },
  {
      x: 1,
      z: 3,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 2,
      z: 3.5,
  },
  {
      x: 4,
      z: 2.5,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 6,
      z: 4,
  },
  {
      x: 8.5,
      z: 4,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 10,
      z: 4,
  },
  {
      x: 12,
      z: 2,
  },
  0.8,
  "X"
);


// 4th left-most column-----------------------------------------------------------------


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -12,
      z: 8,
  },
  {
      x: -10,
      z: 8,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -8,
      z: 8,
  },
  {
      x: -6,
      z: 8,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -5,
      z: 8,
  },
  {
      x: -2,
      z: 8,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 0,
      z: 8,
  },
  {
      x: 2,
      z: 8,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 2,
      z: 8,
  },
  {
      x: 6,
      z: 6,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 7,
      z: 8,
  },
  {
      x: 10,
      z: 8,
  },
  0.8,
  "X"
);


//-------- wall code start -------------
      const boxGeometry5 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const left = new THREE.Mesh(boxGeometry5, boxMaterial5);
      left.position.set(-0, 2.5, -10);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, -10),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, -10),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, -10),
      });
       scene.add(left);


      const boxGeometry4 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
      right.position.set(-0, 2.5, 12);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, 12),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, 12),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, 12),
      });
       scene.add(right);


        const boxGeometry2 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        //bottom.position.set(-15, -12.5, 0);
        bottom.position.set(-15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(-15, 2.5, -0 + 28 / 2),
        });
        scene.add(bottom);


        const boxGeometry6 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial6 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry6, boxMaterial6);
        //bottom.position.set(-15, -12.5, 0);
        top.position.set(15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(15, 2.5, -0 + 28 / 2),
        });
        scene.add(top);
    
        parameters.wallData = wallData;

    
//----- wall code    end-----

}
//--------------- end --- For Torso Crowd-like Dense Scenario------------------------------------------------------------------------





// --------- start ------- For Torso Crowd-like Dense Scenario  -------------------------------------------------------------
function dense_Scenario_As_Torso_Crowd_Paper_V6() {

  parameters.scenario = 'dense_torso_like';

//   addColumnAgentGroup(
//     agentData,
//     1,
//     RADIUS * 1.5,
//     {
//         x: -15.0,
//         z: -6.00,
//     },
//     {
//         x: -15,
//         z: -6.0,
//     },
//     0.8,
//     "X"
// );

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -15.0,
      z: 9.50,
  },
  {
      x: 12,
      z: -6.0,
  },
  0.8,
  "X"
);

  //working latest - 3
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 5; j++) {
  
    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
      x: 11 - i * 4.2,
      z: 10 - j * 4.2,

      },
      {
      x: 10 - i * 4.2,
      z: 10 - j * 4.2,
      },
      0.8,
      "X"
      );

      }
    }

//-------- wall code start -------------

      const boxGeometry5 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const left = new THREE.Mesh(boxGeometry5, boxMaterial5);
      left.position.set(-0, 2.5, -11);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, -11),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, -11),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, -11),
      });
      scene.add(left);

      const boxGeometry4 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
      right.position.set(-0, 2.5, 14);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, 14),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, 14),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, 14),
      });
      scene.add(right);


        const boxGeometry2 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        //bottom.position.set(-15, -12.5, 0);
        bottom.position.set(-19, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(-19, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-19, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(-19, 2.5, -0 + 28 / 2),
        });
        scene.add(bottom);


        const boxGeometry6 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial6 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry6, boxMaterial6);
        //bottom.position.set(-15, -12.5, 0);
        top.position.set(15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(15, 2.5, -0 + 28 / 2),
        });
        scene.add(top);

        parameters.wallData = wallData;

//----- wall code    end-----

}
//--------------- end --- For Torso Crowd-like Dense Scenario------------------------------------------------------------------------





// --------- start ------- For Torso Crowd-like Dense Scenario  -------------------------------------------------------------
function dense_Scenario_As_Torso_Crowd_Paper_V7() {

  parameters.scenario = 'dense_torso_like';

//   addColumnAgentGroup(
//     agentData,
//     1,
//     RADIUS * 1.5,
//     {
//         x: -15.0,
//         z: -6.00,
//     },
//     {
//         x: -15,
//         z: -6.0,
//     },
//     0.8,
//     "X"
// );


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -15.0,
      z: 9.50,
  },
  {
      x: 12,
      z: -6.0,
  },
  0.8,
  "X"
);


  //working latest - 3
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 5; j++) {
  
    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
      x: 11 - i * 3.2,
      z: 10 - j * 4.2,

      },
      {
      x: 10 - i * 3.2,
      z: 10 - j * 4.2,
      },
      0.8,
      "X"
      );

      }
    }

//-------- wall code start -------------

      const boxGeometry5 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const left = new THREE.Mesh(boxGeometry5, boxMaterial5);
      left.position.set(-0, 2.5, -11);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, -11),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, -11),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, -11),
      });
      scene.add(left);

      const boxGeometry4 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
      right.position.set(-0, 2.5, 14);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, 14),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, 14),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, 14),
      });
      scene.add(right);


        const boxGeometry2 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        //bottom.position.set(-15, -12.5, 0);
        bottom.position.set(-17, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(-17, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-17, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(-17, 2.5, -0 + 28 / 2),
        });
        scene.add(bottom);


        const boxGeometry6 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial6 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry6, boxMaterial6);
        //bottom.position.set(-15, -12.5, 0);
        top.position.set(15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(15, 2.5, -0 + 28 / 2),
        });
        scene.add(top);

        parameters.wallData = wallData;

//----- wall code    end-----


}
//--------------- end --- For Torso Crowd-like Dense Scenario------------------------------------------------------------------------






// --------- start ------- For Torso Crowd-like Dense Scenario  -------------------------------------------------------------
function dense_Scenario_As_Torso_Crowd_Paper_V9() {

  parameters.scenario = 'dense_torso_like';


//   addColumnAgentGroup(
//     agentData,
//     1,
//     RADIUS * 1.5,
//     {
//         x: -15.0,
//         z: -6.00,
//     },
//     {
//         x: -15,
//         z: -6.0,
//     },
//     0.8,
//     "X"
// );

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -15.0,
      z: 9.50,
  },
  {
      x: 12,
      z: -6.0,
  },
  0.8,
  "X"
);

  //working latest - 3
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 5; j++) {
  
    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
      x: 11 - i * 3.0,
      z: 10 - j * 4.2,

      },
      {
      x: 10 - i * 3.0,
      z: 10 - j * 4.2,
      },
      0.8,
      "X"
      );

      }
    }

//-------- wall code start -------------

      const boxGeometry5 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const left = new THREE.Mesh(boxGeometry5, boxMaterial5);
      left.position.set(-0, 2.5, -11);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, -11),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, -11),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, -11),
      });
      scene.add(left);

      const boxGeometry4 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
      right.position.set(-0, 2.5, 14);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, 14),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, 14),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, 14),
      });
      scene.add(right);


        const boxGeometry2 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        //bottom.position.set(-15, -12.5, 0);
        bottom.position.set(-17, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(-17, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-17, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(-17, 2.5, -0 + 28 / 2),
        });
        scene.add(bottom);


        const boxGeometry6 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial6 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry6, boxMaterial6);
        //bottom.position.set(-15, -12.5, 0);
        top.position.set(15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(15, 2.5, -0 + 28 / 2),
        });
        scene.add(top);

        parameters.wallData = wallData;

//----- wall code    end-----

}
//--------------- end --- For Torso Crowd-like Dense Scenario------------------------------------------------------------------------






// --------- start ------- For Torso Crowd-like Dense Scenario  -------------------------------------------------------------
function dense_Scenario_As_Torso_Crowd_Paper_V10() {

  parameters.scenario = 'dense_torso_like';


//   addColumnAgentGroup(
//     agentData,
//     1,
//     RADIUS * 1.5,
//     {
//         x: -15.0,
//         z: -6.00,
//     },
//     {
//         x: -15,
//         z: -6.0,
//     },
//     0.8,
//     "X"
// );

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -15.0,
      z: 11,
  },
  {
      x: 12,
      z: -9.0,
  },
  0.8,
  "X"
);

  //working latest - 3
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 5; j++) {
  
    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
      x: 11 - i * 4.0,
      z: 12 - j * 6.0,

      },
      {
      x: 10 - i * 4.0,
      z: 11 - j * 6.6,
      },
      0.8,
      "X"
      );

      }
    }

//-------- wall code start -------------

      const boxGeometry5 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const left = new THREE.Mesh(boxGeometry5, boxMaterial5);
      left.position.set(-0, 2.5, -16);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, -16),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, -16),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, -16),
      });
      scene.add(left);

      const boxGeometry4 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
      right.position.set(-0, 2.5, 16);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, 16),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, 16),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, 16),
      });
      scene.add(right);


        const boxGeometry2 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        //bottom.position.set(-15, -12.5, 0);
        bottom.position.set(-17, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(-17, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-17, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(-17, 2.5, -0 + 28 / 2),
        });
        scene.add(bottom);


        const boxGeometry6 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial6 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry6, boxMaterial6);
        //bottom.position.set(-15, -12.5, 0);
        top.position.set(15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(15, 2.5, -0 + 28 / 2),
        });
        scene.add(top);

        parameters.wallData = wallData;

//----- wall code    end-----

}
//--------------- end --- For Torso Crowd-like Dense Scenario------------------------------------------------------------------------






// --------- start ------- For Torso Crowd-like Dense Scenario  -------------------------------------------------------------
function dense_Scenario_As_Torso_Crowd_Paper_V14_v2() {

  parameters.scenario = 'dense_torso_like';


//   addColumnAgentGroup(
//     agentData,
//     1,
//     RADIUS * 1.5,
//     {
//         x: -15.0,
//         z: -6.00,
//     },
//     {
//         x: -15,
//         z: -6.0,
//     },
//     0.8,
//     "X"
// );

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -15.0,
      z: 11,
  },
  {
      x: 12,
      z: -12.0,
  },
  0.8,
  "X"
);

  //working latest - 3
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 5; j++) {
  
    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
      x: 11 - i * 4.0,
      z: 12 - j * 6.0,

      },
      {
      x: 10 - i * 4.0,
      z: 11 - j * 6.6,
      },
      0.8,
      "X"
      );

      }
    }


    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 5; j++) {
    
      addColumnAgentGroup(
        agentData,
        1,
        RADIUS * 1.5,
        {
        x: 0 - i * 5.0,
        z: 12 - j * 6.0,
  
        },
        {
        x: -7 - i * 5.0,
        z: 11 - j * 6.6,
        },
        0.8,
        "X"
        );
  
        }
      }

//-------- wall code start -------------

      const boxGeometry5 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const left = new THREE.Mesh(boxGeometry5, boxMaterial5);
      left.position.set(-0, 2.5, -16);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, -16),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, -16),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, -16),
      });
      scene.add(left);

      const boxGeometry4 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
      right.position.set(-0, 2.5, 16);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, 16),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, 16),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, 16),
      });
      scene.add(right);


        const boxGeometry2 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        //bottom.position.set(-15, -12.5, 0);
        bottom.position.set(-17, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(-17, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-17, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(-17, 2.5, -0 + 28 / 2),
        });
        scene.add(bottom);


        const boxGeometry6 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial6 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry6, boxMaterial6);
        //bottom.position.set(-15, -12.5, 0);
        top.position.set(15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(15, 2.5, -0 + 28 / 2),
        });
        scene.add(top);

        parameters.wallData = wallData;

//----- wall code    end-----

}
//--------------- end --- For Torso Crowd-like Dense Scenario------------------------------------------------------------------------



// --------- start ------- For Torso Crowd-like Dense Scenario  -------------------------------------------------------------
function dense_Scenario_As_Torso_Crowd_Paper_V14() {

  parameters.scenario = 'dense_torso_like';


//   addColumnAgentGroup(
//     agentData,
//     1,
//     RADIUS * 1.5,
//     {
//         x: -15.0,
//         z: -6.00,
//     },
//     {
//         x: -15,
//         z: -6.0,
//     },
//     0.8,
//     "X"
// );

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -20.5,
      z: 12.0,
  },
  {
      x: 12,
      z: -13.0,
  },
  0.8,
  "X"
);

  //working latest - 3
  for (let i = 0; i < 1; i++) {
    for (let j = 0; j < 3; j++) {
  
    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
      x: 11 - i * 4.0,
      z: 12 - j * 7.0,

      },
      {
      x: 10 - i * 4.0,
      z: 11 - j * 6.6,
      },
      0.8,
      "X"
      );

      }
    }



    for (let i = 0; i < 1; i++) {
      for (let j = 0; j < 4; j++) {
    
      addColumnAgentGroup(
        agentData,
        1,
        RADIUS * 1.5,
        {
        x: 6 - i * 4.0,
        z: 9 - j * 7.0,
  
        },
        {
        x: 6 - i * 4.0,
        z: 8 - j * 6.6,
        },
        0.8,
        "X"
        );
  
        }
      }


      for (let i = 0; i < 1; i++) {
        for (let j = 0; j < 4; j++) {
      
        addColumnAgentGroup(
          agentData,
          1,
          RADIUS * 1.5,
          {
          x: 1 - i * 4.0,
          z: 12 - j * 7.0,
    
          },
          {
          x: -3 - i * 4.0,
          z: 11.5 - j * 6.6,
          },
          0.8,
          "X"
          );
    
          }
        }

        for (let i = 0; i < 1; i++) {
          for (let j = 0; j < 4; j++) {
        
          addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
            x: -5 - i * 5.0,
            z: 12 - j * 7.2,
      
            },
            {
            x: -7 - i * 5.0,
            z: 13 - j * 7.8,
            },
            0.8,
            "X"
            );
      
            }
          }   
          
    for (let i = 0; i < 1; i++) {
      for (let j = 0; j < 5; j++) {
    
      addColumnAgentGroup(
        agentData,
        1,
        RADIUS * 1.5,
        {
        x: -11 - i * 5.0,
        z: 12 - j * 6.0,
  
        },
        {
        x: -12 - i * 5.0,
        z: 12 - j * 6.6,
        },
        0.8,
        "X"
        );
  
        }
      }

      for (let i = 0; i < 1; i++) {
        for (let j = 0; j < 5; j++) {
      
        addColumnAgentGroup(
          agentData,
          1,
          RADIUS * 1.5,
          {
          x: -15 - i * 5.0,
          z: 12 - j * 6.0,
    
          },
          {
          x: -17 - i * 5.0,
          z: 12 - j * 6.82,
          },
          0.8,
          "X"
          );
    
          }
        }

    // for (let i = 0; i < 3; i++) {
    //   for (let j = 0; j < 5; j++) {
    
    //   addColumnAgentGroup(
    //     agentData,
    //     1,
    //     RADIUS * 1.5,
    //     {
    //     x: 0 - i * 5.0,
    //     z: 12 - j * 6.0,
  
    //     },
    //     {
    //     x: -7 - i * 5.0,
    //     z: 12 - j * 6.6,
    //     },
    //     0.8,
    //     "X"
    //     );
  
    //     }
    //   }

//-------- wall code start -------------

      const boxGeometry5 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const left = new THREE.Mesh(boxGeometry5, boxMaterial5);
      left.position.set(-0, 2.5, -17);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, -17),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, -17),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, -17),
      });
      scene.add(left);

      const boxGeometry4 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
      right.position.set(-0, 2.5, 16);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, 16),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, 16),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, 16),
      });
      scene.add(right);


        const boxGeometry2 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        bottom.position.set(-23, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(-23, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-23, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(-23, 2.5, -0 + 28 / 2),
        });
        scene.add(bottom);


        const boxGeometry6 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial6 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry6, boxMaterial6);
        //bottom.position.set(-15, -12.5, 0);
        top.position.set(15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(15, 2.5, -0 + 28 / 2),
        });
        scene.add(top);

        parameters.wallData = wallData;

//----- wall code    end-----

}
//--------------- end --- For Torso Crowd-like Dense Scenario------------------------------------------------------------------------






//------------- Start -- Rectangle Scenario------------------------------------------------------------------------

function rectangle_Scenario() {

  parameters.scenario = 'rectangle';

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.0,
    {
      x: 14,
      z: 14,
    },
    {
      x: -13,
      z: -14.0,
    },
    0.8,
    "X");

  addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1,
  {
    x: -14,
    z: -14,
  },
  {
    x: 14,
    z: 15,
  },
  0.8,
  "X");

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.0,
    {
      x: 14,
      z: -14,
    },
    {
      x: -13,
      z: 14,
    },
    0.8,
    "X");

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.0,
    {
      x: -14,
      z: 14,
    },
    {
      x: 15,
      z: -14.0,
    },
    0.8,
    "X"); 

}
//------------- End -- Rectangle Scenario------------------------------------------------------------------------




// --------- start ------- For Torso Crowd-like Dense Scenario  -------------------------------------------------------------
function dense_Scenario_As_Torso_Crowd_Paper_V11() {


  parameters.scenario = 'dense_torso_like';

//   addColumnAgentGroup(
//     agentData,
//     1,
//     RADIUS * 1.5,
//     {
//         x: -13,
//         z: 2.00,
//     },
//     {
//         x: -12,
//         z: 2.0,
//     },
//     0.8,
//     "X"
// );


// addColumnAgentGroup(
//   agentData,
//   1,
//   RADIUS * 1.5,
//   {
//       x: 16,
//       z: -8.00,
//   },
//   {
//       x: -12,
//       z: 9.0,
//   },
//   0.8,
//   "X"
// );


// addColumnAgentGroup(
//   agentData,
//   1,
//   RADIUS * 1.5,
//   {
//       x: 13,
//       z: 8.00,
//   },
//   {
//       x: -12,
//       z: -9.0,
//   },
//   0.8,
//   "X"
// );


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 14,
      z: -10.00,
  },
  {
      x: -14,
      z: 8.0,
  },
  0.8,
  "X"
  );

//left most column ------------------------------------------------------------------

//----------------
addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -13,
      z: -10,
  },
  {
      x: -13,
      z: -8,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -8,
      z: -10,
  },
  {
      x: -8,
      z: -8,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -4,
      z: -10,
  },
  {
      x: -3,
      z: -10,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 1,
      z: -9.00,
  },
  {
      x: 1,
      z: -10.0,
  },
  0.8,
  "X"
);


  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: 5,
        z: -10.00,
    },
    {
        x: 5,
        z: -8.0,
    },
    0.8,
    "X"
    );

    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
          x: 10,
          z: -10.00,
      },
      {
          x: 10,
          z: -9.0,
      },
      0.8,
      "X"
      );


      // addColumnAgentGroup(
      //   agentData,
      //   1,
      //   RADIUS * 1.5,
      //   {
      //       x: 14,
      //       z: -10.00,
      //   },
      //   {
      //       x: 14,
      //       z: -8.0,
      //   },
      //   0.8,
      //   "X"
      //   );

// 2nd leftmost column ------------------------------------------------------------------

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -11,
      z: -3.00,
  },
  {
      x: -12,
      z: -5.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -8.0,
      z: -2.00,
  },
  {
      x: -6.0,
      z: -4.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -5,
      z: -2.00,
  },
  {
      x: -1,
      z: -5.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -2,
      z: -2.00,
  },
  {
      x: 4,
      z: -3.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 6,
      z: -2.00,
  },
  {
      x: 8,
      z: -5.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 10,
      z: -2.00,
  },
  {
      x:13,
      z: -3.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 14,
      z: -2.00,
  },
  {
      x: 17,
      z: -3.0,
  },
  0.8,
  "X"
);



// 3rd leftmost column ------------------------------------------------------------------

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -11,
      z: 3.5,
  },
  {
      x: -13,
      z: 2.0,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -9,
      z: 3.5,
  },
  {
      x: -7,
      z: 3.5,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -6,
      z: 3.5,
  },
  {
      x: -3,
      z: 2.5,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -3,
      z: 3.5,
  },
  {
      x: 1,
      z: 3,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 3,
      z: 3.5,
  },
  {
      x: 5.5,
      z: 1.5,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 9,
      z: 3,
  },
  {
      x: 9,
      z: 2 ,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 12,
      z: 4,
  },
  {
      x: 13,
      z: 3,
  },
  0.8,
  "X"
);


// 4th left-most column-----------------------------------------------------------------


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -12,
      z: 9,
  },
  {
      x: -9,
      z: 9,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -5,
      z: 8,
  },
  {
      x: -4,
      z: 8,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 0,
      z: 9,
  },
  {
      x: 1,
      z: 9,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 4,
      z: 10,
  },
  {
      x: 5,
      z: 10,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 9,
      z: 9,
  },
  {
      x: 9,
      z: 11,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 13,
      z: 10,
  },
  {
      x: 14,
      z: 9,
  },
  0.8,
  "X"
);

/*
//-------- wall code start -------------
      const boxGeometry5 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const left = new THREE.Mesh(boxGeometry5, boxMaterial5);
      left.position.set(-0, 2.5, -11);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, -11),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, -11),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, -11),
      });
       scene.add(left);


      const boxGeometry4 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
      right.position.set(-0, 2.5, 12);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, 12),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, 12),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, 12),
      });
       scene.add(right);


        const boxGeometry2 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        //bottom.position.set(-15, -12.5, 0);
        bottom.position.set(-15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(-15, 2.5, -0 + 28 / 2),
        });
        scene.add(bottom);


        const boxGeometry6 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial6 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry6, boxMaterial6);
        //bottom.position.set(-15, -12.5, 0);
        top.position.set(15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(15, 2.5, -0 + 28 / 2),
        });
        scene.add(top);
    
        parameters.wallData = wallData;
*/
    
//----- wall code    end-----


}
//--------------- end --- For Torso Crowd-like Dense Scenario------------------------------------------------------------------------


function dense_Scenario_As_Torso_Crowd_Paper_V12() 
{

  parameters.scenario = 'dense_torso_like';

    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
          x: -20,
          z: 2.00,
      },
      {
          x: 20,
          z: 2.0,
      },
      0.8,
      "X"
  );


  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -10,
        z: -2.00,
    },
    {
        x: -8,
        z: -2.0,
    },
    0.8,
    "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -10,
      z: 5.00,
  },
  {
      x: -8,
      z: 5.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -4,
      z: 3.00,
  },
  {
      x: -3,
      z: 5.0,
  },
  0.8,
  "X"
);

//-----------
addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -4,
      z: -4.0,
  },
  {
      x: -3,
      z: -3.0,
  },
  0.8,
  "X"
);
//-----------


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 0,
      z: 0.0,
  },
  {
      x: 2,
      z: 1.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 0,
      z: -5.0,
  },
  {
      x: 2,
      z: -6.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 4,
      z: -3.0,
  },
  {
      x: 6,
      z: -1.5,
  },
  0.8,
  "X"
);

//-----------------------------------------

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 4,
      z: -3.0,
  },
  {
      x: 6,
      z: -1.5,
  },
  0.8,
  "X"
);
  



//-------- wall code start -------------
/*
      const boxGeometry5 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const left = new THREE.Mesh(boxGeometry5, boxMaterial5);
      left.position.set(-0, 2.5, -10);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, -10),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, -10),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, -10),
      });
       scene.add(left);


      const boxGeometry4 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
      right.position.set(-0, 2.5, 12);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, 12),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, 12),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, 12),
      });
       scene.add(right);


        const boxGeometry2 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        //bottom.position.set(-15, -12.5, 0);
        bottom.position.set(-15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(-15, 2.5, -0 + 28 / 2),
        });
        scene.add(bottom);


        const boxGeometry6 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial6 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry6, boxMaterial6);
        //bottom.position.set(-15, -12.5, 0);
        top.position.set(15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(15, 2.5, -0 + 28 / 2),
        });
        scene.add(top);

        parameters.wallData = wallData;
*/
//----- wall code    end-----

}




function dense_Scenario_As_Torso_Crowd_Paper_V13() 
{

  parameters.scenario = 'dense_torso_like';

    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
          x: -20,
          z: 2.00,
      },
      {
          x: 21,
          z: 2.0,
      },
      0.8,
      "X"
  );


  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -10,
        z: -2.00,
    },
    {
        x: -8,
        z: -1.0,
    },
    0.8,
    "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -10,
      z: 5.00,
  },
  {
      x: -8,
      z: 4.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -4,
      z: 2.00,
  },
  {
      x: -5,
      z: 4.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -4,
      z: -4.0,
  },
  {
      x: -3,
      z: -1.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 0,
      z: 2.0,
  },
  {
      x: 2,
      z: 3.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 0,
      z: -5.0,
  },
  {
      x: 2,
      z: -3.0,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 4,
      z: -3.0,
  },
  {
      x: 6,
      z: -1.5,
  },
  0.8,
  "X"
);


addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 4,
      z: -3.0,
  },
  {
      x: 6,
      z: -1.5,
  },
  0.8,
  "X"
);

//-----------------------------------------

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 6,
      z: -3.0,
  },
  {
      x: 7,
      z: -1.5,
  },
  0.8,
  "X"
);







}


















// --------- start ------- For Torso Crowd-like Dense Scenario  -------------------------------------------------------------
function dense_Scenario_As_Torso_Crowd_Paper_V8() {

  parameters.scenario = 'dense_torso_like';


//   addColumnAgentGroup(
//     agentData,
//     1,
//     RADIUS * 1.5,
//     {
//         x: -15.0,
//         z: 6.00,
//     },
//     {
//         x: 12,
//         z: -6.0,
//     },
//     0.8,
//     "X"
// );

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -15.0,
      z: 9.50,
  },
  {
      x: 12,
      z: -6.0,
  },
  0.8,
  "X"
);

  //working latest - 3
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 5; j++) {
  
    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
      x: 11 - i * 4.4,
      z: 10 - j * 4.4,

      },
      {
      x: 10 - i * 4.4,
      z: 10 - j * 4.4,
      },
      0.8,
      "X"
      );

      }
    }

//-------- wall code start -------------

      const boxGeometry5 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const left = new THREE.Mesh(boxGeometry5, boxMaterial5);
      left.position.set(-0, 2.5, -11);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, -11),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, -11),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, -11),
      });
      scene.add(left);

      const boxGeometry4 = new THREE.BoxGeometry(28, 5, 1);
      const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
      const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
      right.position.set(-0, 2.5, 14);
      wallData.push({
          center: new THREE.Vector3(-0, 2.5, 14),
          depth: 1, // along z-axis
          width: 28, // along x-axis
          base: new THREE.Vector3(-0 - 28 / 2, 2.5, 14),
          tip: new THREE.Vector3(-0 + 28 / 2, 2.5, 14),
      });
      scene.add(right);


        const boxGeometry2 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        //bottom.position.set(-15, -12.5, 0);
        bottom.position.set(-17, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(-17, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-17, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(-17, 2.5, -0 + 28 / 2),
        });
        scene.add(bottom);


        const boxGeometry6 = new THREE.BoxGeometry(1, 5, 28);
        const boxMaterial6 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry6, boxMaterial6);
        //bottom.position.set(-15, -12.5, 0);
        top.position.set(15, 2.5, -0);

        wallData.push({
            center: new THREE.Vector3(15, 2.5, -0),
            depth: 28, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(15, 2.5, -0 - 28/2),
            tip: new THREE.Vector3(15, 2.5, -0 + 28 / 2),
        });
        scene.add(top);

        parameters.wallData = wallData;

//----- wall code    end-----

}



//********************************************************* *********************************************************
function narrow_hallwayTwoAgent_FaceToFace_Scenario_temp() {

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -35,
        // z: -2.50,
        z: -5.5,     
    },
    {
        x: 25,
        // z: -2.5,
        z: -5.5,
    },
    0.8,
    "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -12,
      z: -3,
  },
  {
    x: -12.000000001,
    z: -3,
  },
  0.8,
  "X"
);

  // experiment border
  const boxGeometry1 = new THREE.BoxGeometry(31, 5, 1);
  const boxMaterial1 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
  const left = new THREE.Mesh(boxGeometry1, boxMaterial1);
  // left.position.set(20, 2.5, 0);
  left.position.set(-10, 2.5, 0);

  wallData.push({
      center: new THREE.Vector3(-10, 2.5, 0),
      depth: 1, // along z-axis
      width: 31, // along x-axis
      base: new THREE.Vector3(-10 - 31/2, 2.5, 0),
      tip: new THREE.Vector3(-10 + 31/2, 2.5, 0),
  });

  const boxGeometry4 = new THREE.BoxGeometry(31, 5, 1);
  const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
  const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
  // right.position.set(-30, 2.5, 0);
  right.position.set(-10, 2.5, -9);
  wallData.push({
      center: new THREE.Vector3(-10, 2.5, -9),
      depth: 1, // along z-axis
      width: 31, // along x-axis
      base: new THREE.Vector3(-10 - 31 / 2, 2.5, -9),
      tip: new THREE.Vector3(-10 + 31 / 2, 2.5, -9),
  });

  scene.add(left);
  scene.add(right);

  parameters.wallData = wallData;


}
// --------------------------------------------------------------------------------------------------------------------------------




/*
//********************************************************* *********************************************************

function narrow_hallwayTwoAgent_FaceToFace_Scenario() {

    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
          x: 15,
          // z: -2.50,
          z: -3.5,
      },
      {
          x: -25,
          // z: -2.5,
          z: -3.5,
      },
      0.8,
      "X"
  );

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -30,
        // z: -6.0,
        // z: -5.0,
        z: -5.5,
    },
    {
        x: 15,
        // z: -6.0,
        // z: -5.0,
        z: -5.5,
    },
    0.8,
    "X"
);

    // experiment border
    const boxGeometry1 = new THREE.BoxGeometry(31, 5, 1);
    const boxMaterial1 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    const left = new THREE.Mesh(boxGeometry1, boxMaterial1);
    // left.position.set(20, 2.5, 0);
    left.position.set(-10, 2.5, 0);
  
    wallData.push({
        center: new THREE.Vector3(-10, 2.5, 0),
        depth: 1, // along z-axis
        width: 31, // along x-axis
        base: new THREE.Vector3(-10 - 31/2, 2.5, 0),
        tip: new THREE.Vector3(-10 + 31/2, 2.5, 0),
    });
  
    const boxGeometry4 = new THREE.BoxGeometry(31, 5, 1);
    const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
    // right.position.set(-30, 2.5, 0);
    right.position.set(-10, 2.5, -9);
    wallData.push({
        center: new THREE.Vector3(-10, 2.5, -9),
        depth: 1, // along z-axis
        width: 31, // along x-axis
        base: new THREE.Vector3(-10 - 31 / 2, 2.5, -9),
        tip: new THREE.Vector3(-10 + 31 / 2, 2.5, -9),
    });
  
    scene.add(left);
    scene.add(right);
  
    parameters.wallData = wallData;

  }
*/

//========================================================================================

//********************************************************* *********************************************************

function narrow_hallwayTwoAgent_FaceToFace_Scenario() {

  parameters.scenario = 'narrow_hallwayTwoAgent_FaceToFace';
/*
  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -25,
        z: -1.8,
    },
    {
        x: 20,
        z: -1.8,
    },
    0.8,
    "X"
);



  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: 6,
        z: -1.30,
    },
    {
        x: -30,
        z: -1.30,
    },
    0.8,
    "X"
);
*/

/*
addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -30.0045,    // -30.000017,
      z: -2.07,    //z: -2.0,
  },
  {
      x: 20,
      z: -2.07,    //  z: -2.0,
  },
  0.8,
  "X"
);



addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 10,
      z: -0.940,
      // z: -0.950,    //z: -0.950,
  },
  {
      x: -30,
      z: -0.940,
      // z: -0.950,    //z: -0.950,
  },
  0.8,
  "X"
);
*/



addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -30.0045,    // -30.000017,
      z: -2.07,    //z: -2.0,
  },
  {
      x: 20,
      z: -2.07,    //  z: -2.0,
  },
  0.8,
  "X"
);



addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 10,
      z: -0.94,    // -0.946,
      // z: -0.950,    //z: -0.950,
  },
  {
      x: -30,
      z: -0.94,   //z: -0.946,
      // z: -0.950,    //z: -0.950,
  },
  0.8,
  "X"
);




//---------------------------------------------------------------------------------

// addColumnAgentGroup(
//   agentData,
//   1,
//   RADIUS * 1.5,
//   {
//       x: -30,
//       z: -18.0,
//   },
//   {
//       x: 20,
//       z: -18.0,
//   },
//   0.8,
//   "X"
// );

// addColumnAgentGroup(
//   agentData,
//   1,
//   RADIUS * 1.5,
//   {
//       x: -30,
//       z: 18.0,
//   },
//   {
//       x: 20,
//       z: 18.0,
//   },
//   0.8,
//   "X"
// );


  // experiment border
  const boxGeometry1 = new THREE.BoxGeometry(18, 5, 1);
  const boxMaterial1 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
  const left = new THREE.Mesh(boxGeometry1, boxMaterial1);
  // left.position.set(20, 2.5, 0);
  // left.position.set(-10, 2.5, 0);
  left.position.set(-10, 2.5, 2.3);

  wallData.push({
      center: new THREE.Vector3(-10, 2.5, 2.3),
      depth: 1, // along z-axis
      width: 18, // along x-axis
      base: new THREE.Vector3(-10 - 18/2, 2.5, 2.3),
      tip: new THREE.Vector3(-10 + 18/2, 2.5, 2.3),
  });

  const boxGeometry4 = new THREE.BoxGeometry(18, 5, 1);
  const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
  const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
  // right.position.set(-30, 2.5, 0);
  // right.position.set(-10, 2.5, -4);
  right.position.set(-10, 2.5, -5.25);
  wallData.push({
      center: new THREE.Vector3(-10, 2.5, -5.25),
      depth: 1, // along z-axis
      width: 18, // along x-axis
      base: new THREE.Vector3(-10 - 18 / 2, 2.5, -5.25),
      tip: new THREE.Vector3(-10 + 18 / 2, 2.5, -5.25),
  });

  scene.add(left);
  scene.add(right);

  parameters.wallData = wallData;
}

// --------------------------------------------------------------------------------------------------------------------------------








// ------------------------- swap_Through_Narrow_Exit_Scenario --------- Start -------------------------------------------------------------------------------------------------------
function swap_Through_Narrow_Exit_Scenario() {

  parameters.scenario = 'swap_Scenario';

  // index 0
  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        // x: 2,
        x: 1,
        // z: -0.80,
        z: 0.0,
    },
    {
        x: -20,
        // z: -0.8,
        z: 0.0,
    },
    0.8,
    "X"
  );


// index 1
addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: 6.1,
      z: -8.0,
  },
  {
      // x: -20,
      // z: -8.0,

      x: 4.0,
      // z: -8.0,
      z: -8.0,
  },
  0.8,
  "X"
    );



// index 2
addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
    x: 7,
    z: 5,
  },
  {
    // x: -20,
    // z: 5,

    // x: 6,
    x: 5.5,
    // z: 5,
    z: 5,
  },
    0.8,
    "X"
  );

    //---------------------------------------------------------------

    // index 3
  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: 12.0,
        z: -0.8,
    },
    {
        // x: -30,
        // z: -0.8,

        x: 11.0,
        z: -0.8,
    },
    0.8,
    "X"
  );
  
    
  // index 4
  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: 12.0,
        z: -10.0,
    },
    {
        // x: -30,
        // z: -8.0,

        x: 11.0,
        z: -10.0,
    },
    0.8,
    "X"
      );
  

// index 5 
  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
      x: 13,
      z: 7,
    },
      {
      // x: -30,
      // z: 5,

      x: 12,
      z: 7,
      },
      0.8,
      "X"
    );

 //------------- 1st group end------------------------------ 

//------------------- 2nd group start------------------------

 // index 6 
 addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -21,
      // z: -1.8,
      // z: -2.1,
      z: -1.5,
  },
  {
      x: 20,
      // z: -1.8,
      // z: -2.1,
      z: -1.5,
  },
  0.8,
  "X"
);

// index  7
  addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      // x: -24,
      x: -25,
      z: 3,
  },
  {
      // x: 20,
      // z: 3,

      x: -24.5,
      z: 3,
  },
  0.8,
  "X"
    );


// index 8
  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        // x: -25,
        x: -27,
        // z: -7,
        z: -7.5,
    },
    {
        // x: 20,
        // z: -7,

        x: -26,
        // z: -7,
        z: -7.5,
    },
    0.8,
    "X"
      );
//-------------------------------------------------- 

// index 9
 addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -34,
      z: -1.8,
  },
  {
      // x: 20,
      // z: -1.8,

      x: -32,
      z: -1.8,
  },
  0.8,
  "X"
);


// index 10
  addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
      x: -34,
      z: 5,
  },
  {
      // x: 20,
      // z: 3,

      x: -32,
      z: 5,
  },
  0.8,
  "X"
    );


// index 11
  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -34,
        z: -9,
    },
    {
        // x: 20,
        // z: -7,

        x: -32,
        z: -9,
    },
    0.8,
    "X"
      );

//--------------------------------------------------
  
//---------------------------------------------------------------------------------------------------------------
    const boxGeometry3 = new THREE.BoxGeometry( 6, 5, 1);
    const boxMaterial3 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    const right2 = new THREE.Mesh(boxGeometry3, boxMaterial3);
    right2.position.set(-10, 2.5, 3.4);
  
    wallData.push({
        center: new THREE.Vector3(-10, 2.5, 3.4),
        depth: 1, // along z-axis
        width: 6, // along x-axis
        base: new THREE.Vector3(-10 - 6/2, 2.5, 3.4),
        tip: new THREE.Vector3(-10 + 6/2, 2.5, 3.4),
    });
    scene.add(right2);


    const boxGeometry_right4 = new THREE.BoxGeometry( 6, 5, 1);
    const boxMaterial_right4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    const right4 = new THREE.Mesh(boxGeometry_right4, boxMaterial_right4);
    right4.position.set(-10, 2.5, 4.4);
  
    wallData.push({
        center: new THREE.Vector3(-10, 2.5, 4.4),
        depth: 1, // along z-axis
        width: 6, // along x-axis
        base: new THREE.Vector3(-10 - 6/2, 2.5, 4.4),
        tip: new THREE.Vector3(-10 + 6/2, 2.5, 4.4),
    });
    scene.add(right4);


    const boxGeometry_right5 = new THREE.BoxGeometry( 6, 5, 1);
    const boxMaterial_right5 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    const right5 = new THREE.Mesh(boxGeometry_right5, boxMaterial_right5);
    right5.position.set(-10, 2.5, 5.4);
  
    wallData.push({
        center: new THREE.Vector3(-10, 2.5, 5.4),
        depth: 1, // along z-axis
        width: 6, // along x-axis
        base: new THREE.Vector3(-10 - 6/2, 2.5, 5.4),
        tip: new THREE.Vector3(-10 + 6/2, 2.5, 5.4),
    });
    scene.add(right5);

    const boxGeometry_right6 = new THREE.BoxGeometry( 6, 5, 1);
    const boxMaterial_right6 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    const right6 = new THREE.Mesh(boxGeometry_right6, boxMaterial_right6);
    right6.position.set(-10, 2.5, 6.4);
  
    wallData.push({
        center: new THREE.Vector3(-10, 2.5, 6.4),
        depth: 1, // along z-axis
        width: 6, // along x-axis
        base: new THREE.Vector3(-10 - 6/2, 2.5, 6.4),
        tip: new THREE.Vector3(-10 + 6/2, 2.5, 6.4),
    });
    scene.add(right6);


    const boxGeometry_right7 = new THREE.BoxGeometry( 6, 5, 25);
    const boxMaterial_right7 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    const right7 = new THREE.Mesh(boxGeometry_right7, boxMaterial_right7);
    right7.position.set(-10, 2.5, 19.4);
  
    wallData.push({
        center: new THREE.Vector3(-10, 2.5, 19.4),
        depth: 1, // along z-axis
        width: 6, // along x-axis
        base: new THREE.Vector3(-10 - 6/2, 2.5, 19.4),
        tip: new THREE.Vector3(-10 + 6/2, 2.5, 19.4),
    });
    scene.add(right7);

    const boxGeometry1 = new THREE.BoxGeometry( 6, 5, 1);
    const boxMaterial1 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    const right = new THREE.Mesh(boxGeometry1, boxMaterial1);
    right.position.set(-10, 2.5, 3.0);
  
    wallData.push({
        center: new THREE.Vector3(-10, 2.5, 3.0),
        depth: 1, // along z-axis
        width: 6, // along x-axis
        base: new THREE.Vector3(-10 - 6/2, 2.5, 3.0),
        tip: new THREE.Vector3(-10 + 6/2, 2.5, 3.0),
    });
    scene.add(right);
//---------------------------------------------------------------------------------------------------------------

    const boxGeometry4 = new THREE.BoxGeometry(6, 5, 1);
    const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    const left = new THREE.Mesh(boxGeometry4, boxMaterial4);
    left.position.set(-10, 2.5, -5.7);
    wallData.push({
        center: new THREE.Vector3(-10, 2.5, -5.7),
        depth: 1, // along z-axis
        width: 6, // along x-axis
        base: new THREE.Vector3(-10 - 6 / 2, 2.5, -5.76),
        tip: new THREE.Vector3(-10 + 6 / 2, 2.5, -5.7),
    });
    scene.add(left);


    const boxGeometry8 = new THREE.BoxGeometry(6, 5, 25);
    const boxMaterial8 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    const left8 = new THREE.Mesh(boxGeometry8, boxMaterial8);
    left8.position.set(-10, 2.5, -19.1);
    wallData.push({
        center: new THREE.Vector3(-10, 2.5, -19.1),
        depth: 1, // along z-axis
        width: 6, // along x-axis
        base: new THREE.Vector3(-10 - 6 / 2, 2.5, -19.1),
        tip: new THREE.Vector3(-10 + 6 / 2, 2.5, -19.1),
    });
  
    scene.add(left8);

    const boxGeometry9 = new THREE.BoxGeometry(6, 5, 1);
    const boxMaterial9 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    const left9 = new THREE.Mesh(boxGeometry9, boxMaterial9);
    left9.position.set(-10, 2.5, -6.1);
    wallData.push({
        center: new THREE.Vector3(-10, 2.5, -6.1),
        depth: 1, // along z-axis
        width: 6, // along x-axis
        base: new THREE.Vector3(-10 - 6 / 2, 2.5, -6.1),
        tip: new THREE.Vector3(-10 + 6 / 2, 2.5, -6.1),
    });
  
    scene.add(left9);
    
  
    parameters.wallData = wallData;
  }
  
// ------------------------- swap_Through_Narrow_Exit_Scenario --------- End -------------------------------------------------------------------------------------------------------


























  function tryingScenario_Bilas_1_4_agents_V2() {

        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
                x: 15,
                z: -10,
            },
            {
                x: -30,
                z: -10,
            },
            0.8,
            "X"
        );

        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
                x: -15,
                //x: 30,
                z: -6,
            },
            {
                x: 30,
                z: -6,
            },
            0.8,
            "X"
        );


        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
                x: 15,
                z: -10 + 1 * 6,
            },
            {
                x: -999,
                z: -10 + 1 * 6,
            },
            0.8,
            "X"
        );

        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
                x: -15,
                //x: 30,
                z: -6 + 1 * 6,
            },
            {
                x: 999,
                //x: -20,
                z: -6 + 1 * 6,
            },
            0.8,
            "X"
        );

        addColumnAgentGroup(
          agentData,
          1,
          RADIUS * 1.5,
          {
              x: 15,
              z: 2 ,
          },
          {
              x: -999,
              z: 2 ,
          },
          0.8,
          "X"
      );


        // for (let i = 0; i < 1; i++) {
        //     for (let j = 0; j < 2; j++) {
        //         addColumnAgentGroup(
        //             agentData,
        //             1,
        //             RADIUS * 1.5,
        //             {
        //                 x: 30 - i * 6,
        //                 //x: 30,
        //                 z: -10 + j * 6,
        //             },
        //             {
        //                 x: -999,
        //                 //x: -20,
        //                 z: -10 + j * 6,
        //             },
        //             0.8,
        //             "X"
        //         );
        //
        //         addColumnAgentGroup(
        //             agentData,
        //             1,
        //             RADIUS * 1.5,
        //             {
        //                 x: -30 + i * 6,
        //                 //x: 30,
        //                 z: -6 + j * 6,
        //             },
        //             {
        //                 x: 999,
        //                 //x: -20,
        //                 z: -6 + j * 6,
        //             },
        //             0.8,
        //             "X"
        //         );
        //
        //     }
        // }
    }

  function tryingScenario_Bilas_4_agents_sphere() {

        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
                x: 30,
                z: -11,
            },
            {
                x: -999,
                z: -11,
            },
            0.8,
            "X"
        );

        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
                x: -30,
                z: -7,
            },
            {
                x: 999,
                z: -7,
            },
            0.8,
            "X"
        );


        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
                x: 30,
                z: -7,
            },
            {
                x: -999,
                z: -7,
            },
            0.8,
            "X"
        );

        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
                x: -30,
                //x: 30,
                z: -3,
            },
            {
                x: 999,
                //x: -20,
                z: -3,
            },
            0.8,
            "X"
        );


        // for (let i = 0; i < 1; i++) {
        //     for (let j = 0; j < 2; j++) {
        //         addColumnAgentGroup(
        //             agentData,
        //             1,
        //             RADIUS * 1.5,
        //             {
        //                 x: 30 - i * 6,
        //                 //x: 30,
        //                 z: -10 + j * 6,
        //             },
        //             {
        //                 x: -999,
        //                 //x: -20,
        //                 z: -10 + j * 6,
        //             },
        //             0.8,
        //             "X"
        //         );
        //
        //         addColumnAgentGroup(
        //             agentData,
        //             1,
        //             RADIUS * 1.5,
        //             {
        //                 x: -30 + i * 6,
        //                 //x: 30,
        //                 z: -6 + j * 6,
        //             },
        //             {
        //                 x: 999,
        //                 //x: -20,
        //                 z: -6 + j * 6,
        //             },
        //             0.8,
        //             "X"
        //         );
        //
        //     }
        // }
    }

//********************************************************* Trying scenario 1 *********************************************************


//********************************************************* Trying scenario 2 *********************************************************
  // Time: 3.06 seconds seconds of the video
  function tryingScenario_Bilas_2_agents() {

    addColumnAgentGroup(
        agentData,
        1,
        RADIUS * 1.5,
        {
          x: 20,
          z: 0,
        },
        {
          x: -999,
          z: 0,
        },
        0.8,
        "X"
    );
    addColumnAgentGroup(
        agentData,
        1,
        RADIUS * 1.5,
        {
          x: -20,
          z: 0,
        },
        {
          x: 999,
          z: 0,
        },
        0.8,
        "X"
    );

  }


  function tryingScenario_Bilas_1_Sudden_Stop() {

    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
        x: 15,
        z: 0,
      },
      {
        x: -5,
        z: 0,
      },
      0.8,
      "X"
  );

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
      x: 23,
      z: 0.50,
    },
    {
      x: -25,
      z: 3.5,
    },
    0.8,
    "X"
);

  }



  function hallway_facing_2_agents_scenario() {

    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
        x: 20,
        z: 0,
      },
      {
        x: -38,
        z: 0,
      },
      0.8,
      "X"
  );

  addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
        x: -20,
        z: 2,
      },
      {
        x: 38,
        z: 2,
      },
      0.8,
      "X"
  );

  }





  function tryingScenario_Bilas_testing_orientation_4_agents() {

    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
        x: 20,
        z: 0,
      },
      {
        x: -38,
        z: 0,
      },
      0.8,
      "X"
  );

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
      x: 20,
      z: 6,
    },
    {
      x: -38,
      z: 6,
    },
    0.8,
    "X"
);

  addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
        x: -20,
        z: 3,
      },
      {
        x: 38,
        z: 3,
      },
      0.8,
      "X"
  );

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
      x: -20,
      z: 9,
    },
    {
      x: 38,
      z: 9,
    },
    0.8,
    "X"
    );

  }  



  function hallway_facing_3_agents_scenario() {

    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
        x: 20,
        z: 0,
      },
      {
        x: -38,
        z: 0,
      },
      0.8,
      "X"
  );

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
      x: 20,
      z: 6,
    },
    {
      x: -38,
      z: 6,
    },
    0.8,
    "X"
);

  addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
        x: -20,
        z: 3,
      },
      {
        x: 38,
        z: 3,
      },
      0.8,
      "X"
  );

  }  


function hallway_facing_4_agents_scenario() {

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
      x: 20,
      z: 0,
    },
    {
      x: -38,
      z: 0,
    },
    0.8,
    "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
    x: 20,
    z: 6,
  },
  {
    x: -38,
    z: 6,
  },
  0.8,
  "X"
);

addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
      x: -20,
      z: 3,
    },
    {
      x: 38,
      z: 3,
    },
    0.8,
    "X"
);

addColumnAgentGroup(
  agentData,
  1,
  RADIUS * 1.5,
  {
    x: -20,
    z: 9,
  },
  {
    x: 38,
    z: 9,
  },
  0.8,
  "X"
  );

}  


/*
// angleThresholdBtwnDirectionAndNormalInDeg = 0.12;  const timestep = 0.01;  let stif = 0.10; inside collisionConstraint_Capsule();    
function bottleneck_with_wall_scenario() {
parameters.scenario = 'bottleneck';


//working latest - 3
for (let i = 0; i < 9; i++) {
  for (let j = 0; j < 6; j++) {

  let x_goal = 0.0;
  
  if(i < 2)
  {
     x_goal = -2.0;
  }else if(i>1 && i< 4)
  {
     x_goal = -3.2;
  }else if(i>3 && i< 5)
  {
     x_goal = -4.0;
  }else if(i>4 && i< 7)
  {
    x_goal = -6.0;
  }else{
    x_goal = -7.6;
  }


      addColumnAgentGroup(
          agentData,
          1,
          RADIUS * 1.5,
          {
              x: 15 - i * 5.3,
              z: 42 - j * 5.3,
              // x: 15 - i * 5.0,
              // z: 42 - j * 5.0,
          },
          {
              // x: -4.3,
              x: x_goal,
              z: 4,
              // z: 6,
          },
          0.8,
          "X"
      );

  }
}


        // experiment border
        const boxGeometry1 = new THREE.BoxGeometry(31, 5, 1);
        const boxMaterial1 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const left = new THREE.Mesh(boxGeometry1, boxMaterial1);
        left.position.set(20, 2.5, 0);

        wallData.push({
            center: new THREE.Vector3(20, 2.5, 0),
            depth: 1, // along z-axis
            width: 31, // along x-axis
            base: new THREE.Vector3(20 - 31/2, 2.5, 0),
            tip: new THREE.Vector3(20 + 31/2, 2.5, 0),
        });

        const boxGeometry2 = new THREE.BoxGeometry(1, 5, 50);
        const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
        //bottom.position.set(-15, 2.5, 0);
        bottom.position.set(-15, 2.5, -25);

        wallData.push({
            center: new THREE.Vector3(-15, 2.5, -25),
            depth: 50, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(-15, 2.5, -25 - 50/2),
            tip: new THREE.Vector3(-15, 2.5, -25 + 50 / 2),
        });

        const boxGeometry3 = new THREE.BoxGeometry(1, 5, 50);
        const boxMaterial3 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const top = new THREE.Mesh(boxGeometry3, boxMaterial3);
        top.position.set(5, 2.5, -25);
        wallData.push({
            center: new THREE.Vector3(5, 2.5, -25),
            depth: 50, // along z-axis
            width: 1, // along x-axis
            base: new THREE.Vector3(5, 2.5, -25 - 50/2),
            tip: new THREE.Vector3(5, 2.5, -25 + 50/2),
        });

        const boxGeometry4 = new THREE.BoxGeometry(31, 5, 1);
        const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
        const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
        right.position.set(-30, 2.5, 0);
        wallData.push({
            center: new THREE.Vector3(-30, 2.5, 0),
            depth: 1, // along z-axis
            width: 31, // along x-axis
            base: new THREE.Vector3(-30 - 31 / 2, 2.5, 0),
            tip: new THREE.Vector3(-30 + 31 / 2, 2.5, 0),
        });

        scene.add(left);
        scene.add(bottom);
        scene.add(top);
        scene.add(right);

        parameters.wallData = wallData;

    }

*/    


//====================================================================
// angleThresholdBtwnDirectionAndNormalInDeg = 0.12;  const timestep = 0.01;  let stif = 0.10; inside collisionConstraint_Capsule();    
function bottleneck_with_wall_scenario() {
  parameters.scenario = 'bottleneck';
  
  
  //working latest - 3
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 6; j++) {
  
    let x_goal = 0.0;
    
    if(i < 2)
    {
       x_goal = -2.0;
    }else if(i>1 && i< 4)
    {
       x_goal = -3.2;
    }else if(i>3 && i< 5)
    {
       x_goal = -4.0;
    }else if(i>4 && i< 7)
    {
      x_goal = -6.0;
    }else{
      x_goal = -7.6;
    }
  
  
        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
                x: 15 - i * 5.3,
                z: 42 - j * 5.3,
                // x: 15 - i * 5.0,
                // z: 42 - j * 5.0,
            },
            {
                // x: -4.3,
                x: x_goal,
                z: 8,
                // z: 6,
            },
            0.8,
            "X"
        );
  
    }
  }
  
  
          // experiment border
          const boxGeometry1 = new THREE.BoxGeometry(31, 5, 1);
          const boxMaterial1 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
          const left = new THREE.Mesh(boxGeometry1, boxMaterial1);
          left.position.set(20, 2.5, 0);
  
          wallData.push({
              center: new THREE.Vector3(20, 2.5, 0),
              depth: 1, // along z-axis
              width: 31, // along x-axis
              base: new THREE.Vector3(20 - 31/2, 2.5, 0),
              tip: new THREE.Vector3(20 + 31/2, 2.5, 0),
          });
  
          const boxGeometry2 = new THREE.BoxGeometry(1, 5, 50);
          const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
          const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
          //bottom.position.set(-15, 2.5, 0);
          bottom.position.set(-15, 2.5, -25);
  
          wallData.push({
              center: new THREE.Vector3(-15, 2.5, -25),
              depth: 50, // along z-axis
              width: 1, // along x-axis
              base: new THREE.Vector3(-15, 2.5, -25 - 50/2),
              tip: new THREE.Vector3(-15, 2.5, -25 + 50 / 2),
          });
  
          const boxGeometry3 = new THREE.BoxGeometry(1, 5, 50);
          const boxMaterial3 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
          const top = new THREE.Mesh(boxGeometry3, boxMaterial3);
          top.position.set(5, 2.5, -25);
          wallData.push({
              center: new THREE.Vector3(5, 2.5, -25),
              depth: 50, // along z-axis
              width: 1, // along x-axis
              base: new THREE.Vector3(5, 2.5, -25 - 50/2),
              tip: new THREE.Vector3(5, 2.5, -25 + 50/2),
          });
  
          const boxGeometry4 = new THREE.BoxGeometry(31, 5, 1);
          const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
          const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
          right.position.set(-30, 2.5, 0);
          wallData.push({
              center: new THREE.Vector3(-30, 2.5, 0),
              depth: 1, // along z-axis
              width: 31, // along x-axis
              base: new THREE.Vector3(-30 - 31 / 2, 2.5, 0),
              tip: new THREE.Vector3(-30 + 31 / 2, 2.5, 0),
          });
  
          scene.add(left);
          scene.add(bottom);
          scene.add(top);
          scene.add(right);
  
          parameters.wallData = wallData;
  
      }
//====================================================================


















  /*  
    function bottleneck_with_wall_scenario_x3() {
      parameters.scenario = 'bottleneck';
      
      //working latest - 3
      for (let i = 0; i < 15; i++) {
        for (let j = 0; j < 9; j++) {
      
        let x_goal = 0.0;
        
        if(i < 2)
        {
           x_goal = -3.0;
        }else if(i>1 && i< 4)
        {
           x_goal = -4.2;
        }else if(i>3 && i< 5)
        {
           x_goal = -5.0;
        }else if(i>4 && i< 7)
        {
          x_goal = -6.0;
        }else{
          x_goal = -6.0;
        }
      
      
            addColumnAgentGroup(
                agentData,
                1,
                RADIUS * 1.5,  // change it to radius for all the scenarios.
                {
                    x: 37 - i * 5.3,
                    z: 72 - j * 5.3,
                },
                {
                    // x: -4.3,
                    x: x_goal,
                    z: 4,
                    // z: 6,
                },
                0.8,
                "X"
            );
      
        }
      }
      
      
              // experiment border
              const boxGeometry1 = new THREE.BoxGeometry(31, 5, 1);
              const boxMaterial1 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
              const left = new THREE.Mesh(boxGeometry1, boxMaterial1);
              left.position.set(20, 2.5, 0);
      
              wallData.push({
                  center: new THREE.Vector3(20, 2.5, 0),
                  depth: 1, // along z-axis
                  width: 31, // along x-axis
                  base: new THREE.Vector3(20 - 31/2, 2.5, 0),
                  tip: new THREE.Vector3(20 + 31/2, 2.5, 0),
              });
      
              const boxGeometry2 = new THREE.BoxGeometry(1, 5, 50);
              const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
              const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
              //bottom.position.set(-15, 2.5, 0);
              bottom.position.set(-15, 2.5, -25);
      
              wallData.push({
                  center: new THREE.Vector3(-15, 2.5, -25),
                  depth: 50, // along z-axis
                  width: 1, // along x-axis
                  base: new THREE.Vector3(-15, 2.5, -25 - 50/2),
                  tip: new THREE.Vector3(-15, 2.5, -25 + 50 / 2),
              });
      
              const boxGeometry3 = new THREE.BoxGeometry(1, 5, 50);
              const boxMaterial3 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
              const top = new THREE.Mesh(boxGeometry3, boxMaterial3);
              top.position.set(5, 2.5, -25);
              wallData.push({
                  center: new THREE.Vector3(5, 2.5, -25),
                  depth: 50, // along z-axis
                  width: 1, // along x-axis
                  base: new THREE.Vector3(5, 2.5, -25 - 50/2),
                  tip: new THREE.Vector3(5, 2.5, -25 + 50/2),
              });
      
              const boxGeometry4 = new THREE.BoxGeometry(31, 5, 1);
              const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
              const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
              right.position.set(-30, 2.5, 0);
              wallData.push({
                  center: new THREE.Vector3(-30, 2.5, 0),
                  depth: 1, // along z-axis
                  width: 31, // along x-axis
                  base: new THREE.Vector3(-30 - 31 / 2, 2.5, 0),
                  tip: new THREE.Vector3(-30 + 31 / 2, 2.5, 0),
              });
      
              scene.add(left);
              scene.add(bottom);
              scene.add(top);
              scene.add(right);
      
              parameters.wallData = wallData;
      
          }
*/



//=====================================================================================

function bottleneck_with_wall_scenario_x3() {
  parameters.scenario = 'bottleneck';
  
  //working latest - 3
  for (let i = 0; i < 15; i++) {
    for (let j = 0; j < 9; j++) {
  
    let x_goal = 0.0;
    
    if(i < 2)
    {
       x_goal = -3.0;
    }else if(i>1 && i< 4)
    {
       x_goal = -4.2;
    }else if(i>3 && i< 5)
    {
       x_goal = -5.0;
    }else if(i>4 && i< 7)
    {
      x_goal = -6.0;
    }else{
      x_goal = -6.0;
    }
  
  
  //       addColumnAgentGroup(
  //           agentData,
  //           1,
  //           RADIUS * 1.5,  // change it to radius for all the scenarios.
  //           {
  //               x: 37 - i * 5.3,
  //               z: 72 - j * 5.3,
  //           },
  //           {
  //               // x: -4.3,
  //               x: x_goal,
  //               z: 4,
  //               // z: 6,
  //           },
  //           0.8,
  //           "X"
  //       );



  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,  // change it to radius for all the scenarios.
    {
        x: 37 - i * 5.3,
        z: 72 - j * 5.3,
    },
    {
        x: -4,
        z: 10,
    },
    0.8,
    "X"
);



  
    }
  }



  

  
  
          // experiment border
          const boxGeometry1 = new THREE.BoxGeometry(31, 5, 1);
          const boxMaterial1 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
          const left = new THREE.Mesh(boxGeometry1, boxMaterial1);
          left.position.set(20, 2.5, 0);
  
          wallData.push({
              center: new THREE.Vector3(20, 2.5, 0),
              depth: 1, // along z-axis
              width: 31, // along x-axis
              base: new THREE.Vector3(20 - 31/2, 2.5, 0),
              tip: new THREE.Vector3(20 + 31/2, 2.5, 0),
          });
  
          const boxGeometry2 = new THREE.BoxGeometry(1, 5, 50);
          const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
          const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
          //bottom.position.set(-15, 2.5, 0);
          bottom.position.set(-15, 2.5, -25);
  
          wallData.push({
              center: new THREE.Vector3(-15, 2.5, -25),
              depth: 50, // along z-axis
              width: 1, // along x-axis
              base: new THREE.Vector3(-15, 2.5, -25 - 50/2),
              tip: new THREE.Vector3(-15, 2.5, -25 + 50 / 2),
          });
  
          const boxGeometry3 = new THREE.BoxGeometry(1, 5, 50);
          const boxMaterial3 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
          const top = new THREE.Mesh(boxGeometry3, boxMaterial3);
          top.position.set(5, 2.5, -25);
          wallData.push({
              center: new THREE.Vector3(5, 2.5, -25),
              depth: 50, // along z-axis
              width: 1, // along x-axis
              base: new THREE.Vector3(5, 2.5, -25 - 50/2),
              tip: new THREE.Vector3(5, 2.5, -25 + 50/2),
          });
  
          const boxGeometry4 = new THREE.BoxGeometry(31, 5, 1);
          const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
          const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
          right.position.set(-30, 2.5, 0);
          wallData.push({
              center: new THREE.Vector3(-30, 2.5, 0),
              depth: 1, // along z-axis
              width: 31, // along x-axis
              base: new THREE.Vector3(-30 - 31 / 2, 2.5, 0),
              tip: new THREE.Vector3(-30 + 31 / 2, 2.5, 0),
          });
  
          scene.add(left);
          scene.add(bottom);
          scene.add(top);
          scene.add(right);
  
          parameters.wallData = wallData;
  
      }

//=====================================================================================











  //********************************************************* Trying scenario 1 *********************************************************
  // Time: 0.06 seconds of the video

  function hallway_facing_30_agents_scenario() {
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
              x: 38 - i * 6,
              //x: 30,
              z: -10 + j * 6,
            },
            {
              x: -999,
              //x: -20,
              z: -10 + j * 6,
            },
            0.8,
            "X"
        );

        addColumnAgentGroup(
            agentData,
            1,
            RADIUS * 1.5,
            {
              x: -38 + i * 6,
              //x: 30,
              z: -6 + j * 6,
            },
            {
              x: 999,
              //x: -20,
              z: -6 + j * 6,
            },
            0.8,
            "X"
        );

      }
    }
  }

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
function suddenStop_Scenario() {

  parameters.scenario = 'suddenStop';

  //   addColumnAgentGroup(
  //     agentData,
  //     1,
  //     RADIUS * 1.0,
  //     {
  //       x: 28,
  //       z: 1,
  //     },
  //     {
  //       x: -28,
  //       z: 1.0,    // z: 1,    1.4,   z: 1.2, 
  //     },
  //     0.8,
  //     "X"
  // );

  parameters.scenario = 'suddenStop';

    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.0,
      {
        x: 30,
        z: 1.3,
      },
      {
        x: -28,
        z: 7.0,    // z: 1,    1.4,   z: 1.2, 
      },
      0.8,
      "X"
  );

  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
      x: 20,
      z: 0,
    },
    {
      x: 10,
      z: 0,
    },
    0.8,
    "X"
  );

} 


//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------



function tryingScenario_4_Bilas_Capsule() {

    addColumnAgentGroup(
      agentData,
      1,
      RADIUS * 1.5,
      {
          x: 2,
          z: 20,
      },
      {
          x: 2,
          z: -40,
      },
      0.8,
      "X"
  );


  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: 2,
        z: -20,
    },
    {
        x: 2,
        z: 40,
    },
    0.8,
    "X"
    );




    // // experiment border
    // const boxGeometry1 = new THREE.BoxGeometry(31, 5, 1);
    // const boxMaterial1 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    // const left = new THREE.Mesh(boxGeometry1, boxMaterial1);
    // left.position.set(20, 2.5, 0);

    // wallData.push({
    //     center: new THREE.Vector3(20, 2.5, 0),
    //     depth: 1, // along z-axis
    //     width: 31, // along x-axis
    //     base: new THREE.Vector3(20 - 31/2, 2.5, 0),
    //     tip: new THREE.Vector3(20 + 31/2, 2.5, 0),
    // });

    const boxGeometry2 = new THREE.BoxGeometry(1, 5, 50);
    const boxMaterial2 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    const bottom = new THREE.Mesh(boxGeometry2, boxMaterial2);
    //bottom.position.set(-15, 2.5, 0);
    // bottom.position.set(-15, 2.5, -25);
    bottom.position.set(-3, 2.5, -25);

    wallData.push({
        center: new THREE.Vector3(-15, 2.5, -25),
        depth: 50, // along z-axis
        width: 1, // along x-axis
        base: new THREE.Vector3(-15, 2.5, -25 - 50/2),
        tip: new THREE.Vector3(-15, 2.5, -25 + 50 / 2),
    });

    const boxGeometry3 = new THREE.BoxGeometry(1, 5, 50);
    const boxMaterial3 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    const top = new THREE.Mesh(boxGeometry3, boxMaterial3);
    top.position.set(5, 2.5, -25);
    wallData.push({
        center: new THREE.Vector3(5, 2.5, -25),
        depth: 50, // along z-axis
        width: 1, // along x-axis
        base: new THREE.Vector3(5, 2.5, -25 - 50/2),
        tip: new THREE.Vector3(5, 2.5, -25 + 50/2),
    });

    // const boxGeometry4 = new THREE.BoxGeometry(31, 5, 1);
    // const boxMaterial4 = new THREE.MeshBasicMaterial({ color: 0x000f26 });
    // const right = new THREE.Mesh(boxGeometry4, boxMaterial4);
    // right.position.set(-30, 2.5, 0);
    // wallData.push({
    //     center: new THREE.Vector3(-30, 2.5, 0),
    //     depth: 1, // along z-axis
    //     width: 31, // along x-axis
    //     base: new THREE.Vector3(-30 - 31 / 2, 2.5, 0),
    //     tip: new THREE.Vector3(-30 + 31 / 2, 2.5, 0),
    // });

    // scene.add(left);
    scene.add(bottom);
    scene.add(top);
    // scene.add(right);

    parameters.wallData = wallData;

}












  function addColumnAgentGroup(
    agentData,
    numAgents,
    spacing,
    startPos,
    goalPos,
    velocityMagnitude,
    direction
    
  ) {
    let i = 0;
    let initalIdx = agentData.length;
    let dx = 0,
      dz = 0,
      vx = 0,
      vz = 0;

    let distanceToGoal = PHY.distance(
      startPos.x,
      startPos.z,
      goalPos.x,
      goalPos.z
    );
    vx = (velocityMagnitude * (goalPos.x - startPos.x)) / distanceToGoal;
    vz = (velocityMagnitude * (goalPos.z - startPos.z)) / distanceToGoal;

    if (direction == "X") {
      dx = spacing;
    } else if (direction == "Z") {
      dz = spacing;
    }
    while (i < numAgents) {
      agentData.push({
        index: i + initalIdx,
        x: startPos.x + dx * i,
        y: 2.0,
        z: startPos.z + dz * i,
        goal_x: goalPos.x + dx * i,
        goal_y: 0.0,
        goal_z: goalPos.z + dz * i,
        vx: vx,
        vy: 0.0,
        vz: vz,
        v_pref: Math.sqrt(vx * vx + vz * vz),
        radius: RADIUS,
        invmass: 0.5,
        colliding: false,
        group_id: 1,

        normal_to_capsule: [],
        normal_to_capsule_prev: [],

        // direction: [],
        // agent_position: [],

        // point_on_obs:[],
        point_on_obs : new THREE.Vector3(),
        // cur_position : new THREE.Vector3(),
        // vel_direction : new THREE.Vector3(),

        best_in_right_agent: new THREE.Vector3(),
        closest_agent_in_right: new THREE.Vector3(),
        prev_cur_to_best_agent_dist_right: 1000,

        best_in_left_agent: new THREE.Vector3(),
        closest_agent_in_left: new THREE.Vector3(),
        prev_cur_to_best_agent_dist_left: 1000,

        closest_wall_in_right: new THREE.Vector3(),
        closest_wall_in_left: new THREE.Vector3(),
        prev_cur_to_best_wall_dist_right: 1000,
        prev_cur_to_best_wall_dist_left: 1000,

        prev_closest_Wall_in_right: new THREE.Vector3(),
        prev_closest_Wall_in_left: new THREE.Vector3(),

        agent_state: 'passive',

        cur_orientation: 0,
        next_orientation: 0,
        goal_orientation: 0,

        x_prev: 0.0,
        y_prev: 0.0,
        z_prev: 0.0,
        x_2nd_prev: 0.0,
        z_2nd_prev: 0.0,
        x_3rd_prev: 0.0,
        z_3rd_prev: 0.0,
        
        last_hundred_pos: [],

        best: [],
        grad: {
            'x':0,
            'z':0,
            // 'mx':1,
            // 'mz':1,
            's':0,
            'dx':0,
            'dz':0
        },

        prev_grad: {
          'x':null,
          'z':null,
          // 'mx':1,
          // 'mz':1,
          's':0,
          'dx':0,
          'dz':0
        }
      });
      i += 1;
    }
  }

  let i = 0;
  let deltaSpacing = 3;
  let startX, startY, goalX, goalY;
  startX = -25;
  goalX = -25;
  startY = -20;
  goalY = 20;
  world.distanceConstraints = [];






//----------------------------------------------------------
//uncomment any of the scenarios below to test in different scenarios.

  // narrow_hallwayOneAgent_Scenario();
  // dense_Scenario_As_Torso_Crowd_Paper_V14();   //close to v10. latest working version.
  // narrow_hallwayTwoAgent_FaceToFace_Scenario();
  // rectangle_Scenario(); 
  swap_Through_Narrow_Exit_Scenario();  
  // suddenStop_Scenario();

//-------------------------------------------------------------------

  // tryingScenario_Bilas_1_4_agents_V2();
  // oneAgentCrossingGroup();
  // bidirectionalScenario();
  // oneAgentCrossingAGroupInAngle();

  //----------------------------------------------------------







  let agentGeom, agentMaterial, agent;
  let spotLight, spotLightTarget;
  let agentPointGeom, agentPointMaterial, agentPoint;



  agentData.forEach(function (item, index) {
    //agentGeom = new THREE.CylinderGeometry(item.radius, 1, 4, 16);
    agentGeom = new THREE.CapsuleGeometry(item.radius, 2 * item.radius, 4, 8);
    // agentGeom = new THREE.SphereGeometry( item.radius, 32, 16 );
   // agentSphere = new THREE.SphereGeometry( item.radius, 32, 16 );

    if (index % 2 !== 0){
        agentMaterial = new THREE.MeshLambertMaterial({
            color: 0x00ff00,
        });
    }else {
        agentMaterial = new THREE.MeshLambertMaterial({
            color: 0x0000ff,
        });
    }


    agent = new THREE.Mesh(agentGeom, agentMaterial);
    agent.castShadow = true;
    agent.receiveShadow = true;
    agent.userData = {
      index: item.index,
    };
    agent.rotateX(Math.PI / 2);
    // agent.rotateZ(Math.PI / 2);
    scene.add(agent);



    agentPointGeom = new THREE.CapsuleGeometry(item.radius, 2 * item.radius, 4, 8);
    agentPointMaterial = new THREE.MeshLambertMaterial({
      color: 0xffff00,
    });
    agentPoint = new THREE.Mesh(agentPointGeom, agentPointMaterial);
    agentPoint.castShadow = true;
    agentPoint.receiveShadow = true;
    // agent.rotateZ(Math.PI / 2);
    agentPoint.position.set(999, 2.5, 999);

    scene.add(agentPoint);

    // arrow for [x,z]
    let dir = new THREE.Vector3( 0, 1, 0 );
    let origin = agent.position;
    let length = 10;
    let hex = 0xffff00;

    let arrowHelper = new THREE.ArrowHelper( dir, origin, length, hex );
    // scene.add( arrowHelper );
    arrows.push(arrowHelper);

      // arrow for x and z
      let xdir = new THREE.Vector3( 0, 1, 0 );
      let xorigin = agent.position;
      let xhex = 0xffff00;
      let xarrowHelper = new THREE.ArrowHelper( xdir, xorigin, 1, xhex );
      scene.add( xarrowHelper );
      xarrows.push(xarrowHelper);

      let zdir = new THREE.Vector3( 0, 1, 0 );
      let zorigin = agent.position;
      let zhex = 0x00ffff;
      let zarrowHelper = new THREE.ArrowHelper( zdir, zorigin, 1, zhex );
      scene.add( zarrowHelper );
      zarrows.push(zarrowHelper);

    // velocity  indicator
    let g_dir = new THREE.Vector3( 1, 0, 0 );
    let g_origin = agent.position;
    let g_length = 5;
    let g_hex = 0x0000ff;

    let g_arrowHelper = new THREE.ArrowHelper( g_dir, g_origin, g_length, g_hex );
    scene.add( g_arrowHelper );   //uncomment this to visualize the velocity
    g_arrows.push(g_arrowHelper);




    //for capsule facing normal vector
        // arrow for [x,z]
        let dir_n = new THREE.Vector3( 0, 1, 0 );
        let origin_n = agent.position;
        let length_n = 10;
        // let hex_n = 0xffff00;
        let hex_n = 0xFFC0CB;

    
        let arrowHelper_n = new THREE.ArrowHelper( dir_n, origin_n, length_n, hex_n );
        scene.add( arrowHelper_n );
        narrows.push(arrowHelper_n);



    // -----------------
    //adding spotlight code
    spotLight = new THREE.SpotLight(0xffffff);
    spotLight.position.set(item.x, item.y + 6, item.z);
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    spotLight.shadow.camera.near = 500;
    spotLight.shadow.camera.far = 4000;
    spotLight.shadow.camera.fov = 30;
    spotLight.intensity = 0.4;
    spotLight.angle = Math.PI / 8;
    spotLightTarget = new THREE.Object3D();
    scene.add(spotLightTarget);
    spotLight.target = spotLightTarget;
    // scene.add(spotLight);                  // turn off the light here.
    spotLights[item.index] = spotLight;
    // ----------------
    item.agent = agent;
    item.agentPoint = agentPoint;
    pickableObjects.push(agent);
    // pickableObjects.push(agent);

  });
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("mousedown", mouseDown, false);
  // window.addEventListener("mousemove", mouseMove, false);

  // parameters setting
  for (let i =0; i<agentData.length;i++){
      parameters.best.push(
          Array(agentData.length).fill(null)
      )
  }


  let pauseButton = document.getElementById("pause");
  pauseButton.addEventListener("pause", pauseButtonLogic);

  function pauseButtonLogic()
  {
      console.log("pause");
      world.pause=!world.pause;
      if(!world.pause)
      {
          pauseButton.src= "./resources/icons/8666604_pause_icon.png";
      }
      else
      {
          pauseButton.src= "./resources/icons/8666634_play_icon.png";
      }
  }

  let downloadButton = document.getElementById("download");
  downloadButton.addEventListener("download", downloadButtonLogic);

  function parsePositions(data)
  {
    let result = "", curData, curAgent, numAgents=agentData.length;
    for(let i=1; i<world.frame;i++)
    {
      curData = world.positions[i]
      let j;
      for(j=0; j<numAgents-1; j++)
      {
        curAgent = curData[j]
        result+= curAgent.x.toFixed(4) +"," + curAgent.z.toFixed(4) + "," + curAgent.rotation.toFixed(3) + ","
      }
      curAgent = curData[j]
      result+= curAgent.x.toFixed(4) +"," + curAgent.z.toFixed(4) + "," + curAgent.rotation.toFixed(3) + "\n"
    }
    return result;
  }


  function downloadButtonLogic()
  {
      console.log("download");
      if(world.positions)
      {
        console.log(world.positions);
        var textFile = parsePositions(world.positions);
        let a = document.createElement('a');
        //a.href = "data:application/octet-stream,"+encodeURIComponent(JSON.stringify(world.positions));
        a.href = "data:application/octet-stream,"+encodeURIComponent(textFile);
        a.download = 'abc.txt';
        a.click();

      }
  }


}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function mouseMove(event) {
  event.preventDefault();
  if (selected != null) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var intersects = raycaster.intersectObject(grid, false);
    for (let i = 0; i < intersects.length; i++) {

      agentData.forEach(function (member) {
        if (selected != null && member.index === selected) {
          member.goal_x = intersects[i].point.x;
          member.goal_z = intersects[i].point.z;
          // ring.position.x = intersects[i].point.x;
          // ring.position.z = intersects[i].point.z;
        }
      });
      break;
    }
  }
}

function mouseDown(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);



  let intersects = raycaster.intersectObjects(pickableObjects, false);
  for (let i = 0; i < intersects.length; i++) {
    /* TODO finish this part as
     */
    let selectedUserData = intersects[i].object.userData;
    // console.log(agentData[selectedUserData.index]);
    console.log(agentData[selectedUserData.index].grad);
    console.log(selectedUserData.index);

      if (!selected.includes(selectedUserData.index)){
        selected.push(selectedUserData.index);
    }
    if (selected.length > 2){
        selected.shift();

        agentData.forEach(function (a){
           a.agentPoint.position.set(999, 2.5, 999);
        });
    }
    break;
  }
}

function render() {
  renderer.render(scene, camera);
  getRightRotation_v2();  
}

function getRightRotation_v2() {

  agentData.forEach(function (member) {
    const dx = member.goal_x - member.x;
    const dz = member.goal_z - member.z;

    member.goal_orientation = Math.atan2(dz, dx);
    member.agent.rotation.z = member.goal_orientation;

    // if( parameters.scenario == 'swap_Scenario' && member.index == 2)
    // {
    //   member.agent.rotation.z = 4.2;
    // }

  });

}


function animate() {
  // console.log(mouse.x, mouse.y);
  requestAnimationFrame(animate);


  if(!world.pause)
  {
    PHY.step(RADIUS, agentData, world, scene, parameters); 
    world.frame=world.frame+1;
  }
  world.positions[world.frame] = {}

    // console.log(parameters.best);
  agentData.forEach(function (member, index) {
    world.positions[world.frame][index] = {"x": member.x, "z":member.z, "rotation": member.agent.rotation.z};

    member.agent.position.x = member.x;
    member.agent.position.y = member.y;
    member.agent.position.z = member.z;

    // const dx = member.x - member.x_prev; 
    // const dz = member.z - member.z_prev;

    // const dx = member.x_2nd_prev - member.x_3rd_prev; 
    // const dz = member.z_2nd_prev - member.z_3rd_prev;

    // member.agent.rotation.z = Math.atan2(dz, dx); 
    // console.log("index: ", member.index, ", member.x: ", member.x, ", member.z" , member.z, ", member.x_prev, ", member.x_prev, ", member.z_prev, ", member.z_prev, ", member.x_2nd_prev", member.x_2nd_prev, ", member.z_2nd_prev: ", member.z_2nd_prev , ", member.x_3rd_prev", member.x_3rd_prev, ", member.z_3rd_prev: ", member.z_3rd_prev);

    member.x_3rd_prev = member.x_2nd_prev;
    member.z_3rd_prev = member.z_2nd_prev;

    member.x_2nd_prev = member.x_prev;
    member.z_2nd_prev = member.z_prev;

    member.x_prev = member.x;
    member.z_prev = member.z;
    
    // const dx = member.goal_x - member.x;
    // const dz = member.goal_z - member.z;
    // member.agent.rotation.z = Math.atan2(dz, dx); 

    // const dx = member.px - member.x;
    // const dz = member.pz - member.z;
    // member.agent.rotation.z = Math.atan2(dz, dx);


/*
//=============================== draw lines from trajectories - start ==========================================
member.agent_position = new THREE.Vector3(member.x, member.y, member.z);

member.last_hundred_pos.push(member.agent_position.clone()); // Add current position to positions array
// console.log("member.last_hundred_pos: ", member.last_hundred_pos);

// If positions array length exceeds 100, remove the oldest position
if (member.last_hundred_pos.length > 100) {
  member.last_hundred_pos.shift();
}
//-------------------------------------------------------------------------
// Function to draw trajectory based on stored positions
// Create a curve using the stored positions
var curve = new THREE.CatmullRomCurve3(member.last_hundred_pos);

// // Create a geometry based on the curve
var points = curve.getPoints(100); // Get 100 points along the curve
var geometry = new THREE.BufferGeometry().setFromPoints(points);

// // Create a material for the trajectory line
var material = new THREE.LineBasicMaterial({ color: 0xff0000 });

// // Create the trajectory line and add it to the scene
var trajectoryLine = new THREE.Line(geometry, material);
scene.add(trajectoryLine);
//=============================== draw lines from trajectories - end==========================================
*/

    member.agent.material = redAgentMaterial;

    if(member.index == 0)
    {
      // member.agent.material = blueAgentMaterial;
    }

    if (member.colliding) {
      // member.agent.material = greenAgentMaterial;
    }
    member.colliding = false;

    if (false && selected.length >0) {

        if (selected.length > 1){
            // visualize best

            let first = selected[0];
            let second = selected[1];

            let pair_best_points = parameters.best[first][second];

            let [first_best, second_best] = pair_best_points;
            agentData[first].agentPoint.position.x = first_best.x;
            agentData[first].agentPoint.position.z = first_best.z;

            agentData[second].agentPoint.position.x = second_best.x;
            agentData[second].agentPoint.position.z = second_best.z;
        }

        let include = selected.includes(member.index);
        if (include){
            member.agent.material = blueAgentMaterial;
        }

    }




    // visualizeXZMagnitude(member, index);
    // visualizeMagnitude(member, index)
    visualizeVelocity(member, index);

    visualizeCapsuleFacingDirection(member, index);


  });
  renderer.render(scene, camera);
  stats.update();
}


init();
render();
animate();

// below are utiities
function visualizeXZMagnitude(member, index) {
    if (xarrows.length > 0) {

        xarrows[index].position.x = member.x;
        xarrows[index].position.y = member.y;
        xarrows[index].position.z = member.z;

        // console.log(member.grad);
        let direction = new THREE.Vector3(0, 1, 0);
        if (member.grad.x !== 0) {
            direction = new THREE.Vector3(member.grad.x, 0, 0);
        }

        xarrows[index].setDirection(direction.normalize());
        xarrows[index].setLength(direction.length() * 10);
    }

    if (zarrows.length > 0) {

        zarrows[index].position.x = member.x;
        zarrows[index].position.y = member.y;
        zarrows[index].position.z = member.z;

        // console.log(member.grad);
        let direction = new THREE.Vector3(0, 1, 0);
        if (member.grad.z !== 0) {
            direction = new THREE.Vector3(0, 0, member.grad.z);
        }

        zarrows[index].setDirection(direction.normalize());
        zarrows[index].setLength(direction.length() * 10);
    }

}
function visualizeMagnitude(member, index){
    if (arrows.length>0){

        arrows[index].position.x = member.x;
        arrows[index].position.y = member.y;
        arrows[index].position.z = member.z;

        // console.log(member.grad);
        let direction = new THREE.Vector3(0, 1, 0);
        if (member.grad.x !== 0 && member.grad.z !== 0){
            direction = new THREE.Vector3(member.grad.x, 0, member.grad.z);
        }

        arrows[index].setDirection(direction.normalize());
        arrows[index].setLength(direction.length()*10);
    }
}


function visualizeVelocity(member, index){
    if (g_arrows.length>0){

        g_arrows[index].position.x = member.x;
        g_arrows[index].position.y = member.y;
        g_arrows[index].position.z = member.z;


        let direction = new THREE.Vector3(member.vx, 0, member.vz);


        g_arrows[index].setDirection(direction.normalize());
        g_arrows[index].setLength(direction.length()*10);
    }
}



function visualizeCapsuleFacingDirection(member, index){
  if (narrows.length>0){

    narrows[index].position.x = member.x;
    narrows[index].position.y = member.y;
    narrows[index].position.z = member.z;


    let direction = new THREE.Vector3(member.normal_to_capsule.x, 0, member.normal_to_capsule.z);
    // console.log("member.normal_to_capsule.x: ", member.normal_to_capsule.x);


      narrows[index].setDirection(direction.normalize());
      narrows[index].setLength(direction.length()*5);
  }
}