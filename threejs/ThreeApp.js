import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import * as shader from "./Shaders/Shader";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";

export default class Sketch {
  constructor(selector) {
    this.areas = [
      { x: 0, y: -0.05, z: 0, r: 0.15 },
      { x: 0, y: -0.52, z: -0.02, r: 0.2 },
      { x: 0.38, y: -0.05, z: 0, r: 0.2 },
    ];

    console.log(selector);
    this.hovered = false;
    this.scene = new THREE.Scene();
    this.container = selector;
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0xeeeeee, 1);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.sphereMeshes = [];
    this.sphereSelected = -1;

    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.001,
      1000
    );
    this.camera.position.set(0, 0, 2);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.time = 0;

    this.isPlaying = true;

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.outlinePass = new OutlinePass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.scene,
      this.camera
    );
    this.outlinePass.selectedObjects = [];
    this.outlinePass.edgeThickness = 1;
    this.outlinePass.edgeGlow = 1.7;
    this.outlinePass.edgeStrength = 1;
    this.outlinePass.visibleEdgeColor.set(0x00ff00);
    this.outlinePass.hiddenEdgeColor.set(0x000000);
    this.composer.addPass(this.outlinePass);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.addObjects();
    this.resize();
    this.render();
    this.setupResize();
  }

  setHovered(hovered) {
    this.hovered = hovered;
  }

  getCameraPosition() {
    return this.camera.position;
  }

  getCameraDirection() {
    const vec = new THREE.Vector3();
    this.camera.getWorldDirection(vec);
    return vec;
  }

  getSphereSelected() {
    return this.sphereSelected;
  }

  onMouseMove(normx, normy) {
    this.mouse.x = normx;
    this.mouse.y = normy;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersectables = this.scene.children.filter(
      (child) =>
        child instanceof THREE.Mesh && !this.sphereMeshes.includes(child)
    );
    const intersects = this.raycaster.intersectObjects(intersectables);

    // console.log(intersects.len gth);
    if (intersects.length > 0) {
      //toggle outline effect on
      this.outlinePass.selectedObjects = [intersects[0].object];
    } else {
      //toggle outline effect off
      this.outlinePass.selectedObjects = [];
    }

    const intersectables2 = this.scene.children.filter((child) =>
      this.sphereMeshes.includes(child)
    );
    const intersects2 = this.raycaster.intersectObjects(intersectables2);

    this.sphereSelected = -1;
    for (let i = 0; i < this.sphereMeshes.length; i++) {
      this.sphereMeshes[i].material.opacity = 0;
    }

    if (intersects2.length > 0) {
      //toggle opacity effect on
      intersects2[0].object.material.opacity = 0.7;
      this.sphereSelected = this.sphereMeshes.indexOf(intersects2[0].object);
    }
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this));
  }

  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.outlinePass.setSize(this.width, this.height);
  }

  addObjects() {
    let that = this;
    this.material = new THREE.ShaderMaterial({
      extensions: {
        derivatives: "#extension GL_OES_standard_derivatives : enable",
      },
      side: THREE.DoubleSide,
      uniforms: {
        time: { type: "f", value: 0 },
        resolution: { type: "v4", value: new THREE.Vector4() },
        uvRate1: {
          value: new THREE.Vector2(1, 1),
        },
      },
      vertexShader: shader.vertex,
      fragmentShader: shader.fragment,
    });

    this.geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.plane = new THREE.Mesh(this.geometry, this.material);

    // bg
    const cubeTexture = new THREE.CubeTexture();
    const size = 256;
    const faces = ["px", "nx", "py", "ny", "pz", "nz"];
    faces.forEach((face) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, "#777777");
      gradient.addColorStop(1, "#777777");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      cubeTexture.images[faces.indexOf(face)] = canvas;
    });

    cubeTexture.needsUpdate = true;
    this.scene.environment = cubeTexture;
    this.scene.background = cubeTexture;

    this.lightgroup = new THREE.Group();
    this.scene.add(this.lightgroup);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.lightgroup.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffffff, 2.5);
    spotLight.position.set(6, 2, 10);
    spotLight.castShadow = true;
    this.lightgroup.add(spotLight);

    // laod stl file
    const loader = new STLLoader();
    loader.load(
      "Models/untitled.stl",
      (geometry) => {
        geometry.computeVertexNormals();
        geometry.scale(2, 2, 2);
        geometry.center();
        geometry.rotateX(-Math.PI / 2);

        const metalMaterial = new THREE.MeshStandardMaterial({
          color: 0xaaaaaa,
          metalness: 0.8,
          roughness: 0.2,
          envMapIntensity: 1.0,
          flatShading: false,
        });
        const mesh = new THREE.Mesh(geometry, metalMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        this.outlinePass.selectedObjects = [mesh];
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      (error) => {
        console.log("An error happened");
      }
    );

    this.addRings(this.areas);
  }

  addRings(data) {
    for (let i = 0; i < data.length; i++) {
      const sphereGeometry = new THREE.SphereGeometry(data[i].r, 32, 32);

      const sphereMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.5,
      });
      const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);

      sphereMesh.position.set(data[i].x, data[i].y, data[i].z);
      this.scene.add(sphereMesh);
      if (this.sphereMeshes.length < data.length) {
        this.sphereMeshes.push(sphereMesh);
      }
    }
  }

  stop() {
    this.isPlaying = false;
  }

  play() {
    if (!this.isPlaying) {
      this.render();
      this.isPlaying = true;
    }
  }

  render() {
    if (!this.isPlaying) return;
    this.time += 0.05;
    this.material.uniforms.time.value = this.time;

    this.lightgroup.position.set(
      this.camera.position.x + 6,
      this.camera.position.y + 2,
      this.camera.position.z + 10
    );

    this.controls.update();
    requestAnimationFrame(this.render.bind(this));
    this.composer.render();
  }
}
