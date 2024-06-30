import * as THREE from "three";
import * as PHY from "simplePhysics";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

import Stats from "three/addons/libs/stats.module.js";

let renderer, scene, camera;
let world = {
  x: 80,
  z: 80,
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
    orientation: 'front',   // 'front', 'side_step'
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

            tiles[i][j] = new Tile(i, j, object_position.x, object_position.y, object_position.z, cost)

        }
    }
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

  const ringGeometry = new THREE.RingGeometry(1, 3, 12);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
  });
  ring = new THREE.Mesh(ringGeometry, ringMaterial);
  scene.add(ring);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y += 0.01;


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

function rectangle_Scenario_Original() {

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
      x: -8,
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
      x: -13,  //-9,
      z: 14,
    },
    {
      x: 10,
      z: -14.0,
    },
    0.8,
    "X"); 

}
//------------- End -- Rectangle Scenario------------------------------------------------------------------------

//********************************************************* *********************************************************

function narrow_hallwayTwoAgent_FaceToFace_Scenario() {

  parameters.scenario = 'narrow_hallwayTwoAgent_FaceToFace';

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
  
/*
  addColumnAgentGroup(
    agentData,
    1,
    RADIUS * 1.5,
    {
        x: -30.0045,    // -30.000017,
        z: -1.9,    //z: -2.0,
    },
    {
        x: 20,
        z: -1.9,     //  z: -2.0,
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
        z: -0.8,    // -0.946,
    },
    {
        x: -30,
        z: -0.8,   //z: -0.946,
    },
    0.8,
    "X"
  );
  */

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
        x: 5.1,
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
      x: 10.6,
      z: 5,
    },
    {
      // x: -20,
      // z: 5,

      // x: 6,
      x: 5.5,
      // z: 5,
      z: 4,
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

 //------------------------------------------- 
//-------------------------------------------


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
        x: -26,
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




//===========================================================================
// ------------------------- swap_Through_Narrow_Exit_Scenario v2 --------- Start -------------------------------------------------------------------------------------------------------
function swap_Through_Narrow_Exit_Scenario_V2() {

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
      z: 4,
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
  
// ------------------------- swap_Through_Narrow_Exit_Scenario v2 --------- End -------------------------------------------------------------------------------------------------------
//===========================================================================




function tryingScenario_Bilas_1_4_agents_V2() 
{
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
 

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function suddenStop_Scenario() {

  // parameters.scenario = 'suddenStop';

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
        x: 28,
        z: 1,
      },
      {
        x: -28,
        z: 1.0,    // z: 1,    1.4,   z: 1.2, 
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

  function addColumnAgentGroup(
    agentData,
    numAgents,
    spacing,
    startPos,
    goalPos,
    velocityMagnitude,
    direction  ) {
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
  narrow_hallwayTwoAgent_FaceToFace_Scenario();
  // rectangle_Scenario(); 
  // swap_Through_Narrow_Exit_Scenario();  
  // swap_Through_Narrow_Exit_Scenario_V2();    // use this version
  // suddenStop_Scenario();

//-------------------------------------------------------------------
  //  tryingScenario_Bilas_1_4_agents_V2();
  // oneAgentCrossingGroup();
  // bidirectionalScenario();
  // oneAgentCrossingAGroupInAngle();

  // hallway_facing_4_agents_scenario();
  // hallway_facing_2_agents_scenario();
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


// function correct_orientation_Beginning(capsule) {
//     const dx = capsule.goal_x - capsule.x;
//     const dz = capsule.goal_z - capsule.z;
//     capsule.rotation.z = Math.atan2(dz, dx); 

//     return capsule.rotation.z;
// }

function getRightRotation_v2() {

  agentData.forEach(function (member) {
    // member.agent.position.x = member.x;
    // member.agent.position.y = member.y;
    // member.agent.position.z = member.z;

    const dx = member.goal_x - member.x;
    const dz = member.goal_z - member.z;

    // const dx = Math.abs(member.goal_x - member.x) ;
    // const dz = Math.abs(member.goal_z - member.z) ;

    member.goal_orientation = Math.atan2(dz, dx);
    member.agent.rotation.z = member.goal_orientation;

    // member.agent.rotation.z = Math.atan2(dz, dx);

    // console.log("member.x: ", member.x, ", member.z: ", member.z, ", member.goal_x: ", member.goal_x, ", member.goal_z: ", member.goal_z);
    // console.log("id:---------- ", member.index,", rotation: ", member.agent.rotation.z, "\n\n");

  });

}


function animate() {
  // console.log(mouse.x, mouse.y);
  requestAnimationFrame(animate);
  PHY.step(RADIUS, agentData, world, scene, parameters);
  parameters.tempcount += 1;
  // console.log("parameters.tempcount: ", parameters.tempcount);

  agentData.forEach(function (member, index) {

    member.agent.position.x = member.x;
    member.agent.position.y = member.y;
    member.agent.position.z = member.z;

    // const dx = member.x - member.x_prev; 
    // const dz = member.z - member.z_prev;

    // const dx = member.x_2nd_prev - member.x_3rd_prev; 
    // const dz = member.z_2nd_prev - member.z_3rd_prev;

    // member.agent.rotation.z = Math.atan2(dz, dx); 

    member.x_3rd_prev = member.x_2nd_prev;
    member.z_3rd_prev = member.z_2nd_prev;

    member.x_2nd_prev = member.x_prev;
    member.z_2nd_prev = member.z_prev;

    member.x_prev = member.x;
    member.z_prev = member.z;
    
    // const dx = member.goal_x - member.x;
    // const dz = member.goal_z - member.z;
    // member.agent.rotation.z = Math.atan2(dz, dx); 
    // member.agent.rotation.z = getRightRotation(member.x, member.z, member.goal_x, member.goal_z); 

    // console.log("orientation: ", parameters.orientation);

    let cur_orientation = member.agent.rotation.z;
    const dx = member.goal_x - member.x;
    const dz = member.goal_z - member.z;
    // let next_orientation = Math.atan2(dz, dx);
    let next_orientation = member.goal_orientation;

    if(member.index == 1)
    {
      // console.log("cur_orientation: ", cur_orientation, ",next_orientation: ",next_orientation );
      // console.log("member.x: ", member.x, ",member.z: ",member.z, ", member.goal_x: ", member.goal_x, ", member.goal_z: ", member.goal_z );
      // console.log("dx: ", dx, ",dz: ", dz, "\n\n" );

    }
    
    if( parameters.orientation == 'front')
    {

    /*
      let cur_orientation = item.agent.rotation.z;
      let  next_orientation = Math.atan2(dz, dx);
      if( Math.abs(cur_orientation - next_orientation) >= 0.0 )   // 0.0 makes the orientation better after recovering from the full body rotations.
      {
        item.agent.rotation.z = cur_orientation - cur_orientation/200 ;
      }
    */

      // if( Math.abs(cur_orientation - next_orientation) >= 0.08 && cur_orientation > next_orientation)   // 0.0 makes the orientation better after recovering from the full body rotations.
      // {
      //   member.agent.rotation.z = cur_orientation - cur_orientation/150 ;
      // }
      // else{
      //   member.agent.rotation.z = cur_orientation + cur_orientation/150 ;
      // }

/*
      if( Math.abs(cur_orientation - next_orientation) >= 0.08)   // 0.0 makes the orientation better after recovering from the full body rotations.
      {

        // if( cur_orientation >= next_orientation)
        // {
        //   member.agent.rotation.z = cur_orientation - cur_orientation/200 ;
        //   console.log(" still spinning =================================================================1 ");
        // }else{
        //   member.agent.rotation.z = cur_orientation + cur_orientation/200 ;
        //   console.log(" still spinning =================================================================2 ");
        // }


        if( cur_orientation >= next_orientation)
          {
            member.agent.rotation.z = cur_orientation - (cur_orientation - next_orientation)/200 ;
            console.log(" still spinning =================================================================1 ");
          }else{
            member.agent.rotation.z = cur_orientation +  (cur_orientation - next_orientation)/200 ;
            console.log(" still spinning =================================================================2 ");
          }

      }
      */

      // member.agent.rotation.z = Math.atan2(dz, dx); 
      // member.agent.rotation.z = getRightRotation(member.x, member.z, member.goal_x, member.goal_z); 

      // console.log("member.x: ", member.x, ", member.z: ", member.z, ", member.goal_x: ", member.goal_x, ", member.goal_z: ", member.goal_z);
      // console.log("member.agent.rotation.z: ", member.agent.rotation.z);
    }
  
  

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
      member.agent.material = greenAgentMaterial;
    }
    member.colliding = false;

    if (selected.length >0) {

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

    spotLights[member.index].position.set(
      member.x - member.vx,
      member.y - member.vy,
      member.z - member.vz
    );
    spotLights[member.index].target.position.x = member.x;
    spotLights[member.index].target.position.y = member.y;
    spotLights[member.index].target.position.z = member.z;

    // visualizeXZMagnitude(member, index);
    visualizeMagnitude(member, index)
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