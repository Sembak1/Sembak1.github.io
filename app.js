import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';

const canvas=document.querySelector('#scene'), statusEl=document.querySelector('#status'), button=document.querySelector('#ar-button');
const scene=new THREE.Scene(); scene.background=new THREE.Color('#a8c0c6');
const camera=new THREE.PerspectiveCamera(45,1,.01,30); camera.position.set(1.35,1.15,1.7);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.xr.enabled=true; renderer.xr.setReferenceSpaceType('local-floor');
scene.add(new THREE.HemisphereLight(0xffffff,0x667788,2)); const light=new THREE.DirectionalLight(0xffffff,2.2); light.position.set(2,4,3); scene.add(light);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(4,4),new THREE.MeshStandardMaterial({color:0xd6e0e2,roughness:.9})); floor.rotation.x=-Math.PI/2; floor.position.y=-.012; scene.add(floor);
const grid=new THREE.GridHelper(4,20,0x66828a,0xa3b5b8); grid.position.y=-.008; scene.add(grid);
const controls=new OrbitControls(camera,renderer.domElement); controls.target.set(0,.27,0); controls.update();
const reticle=new THREE.Mesh(new THREE.RingGeometry(.11,.15,32),new THREE.MeshBasicMaterial({color:0x32e0d2,side:THREE.DoubleSide})); reticle.rotation.x=-Math.PI/2; reticle.matrixAutoUpdate=false; reticle.visible=false; scene.add(reticle);
let model=null, placed=null, session=null, hitSource=null, modelReady=false, modelFailed=false;
const say=(s)=>statusEl.textContent=s;

new GLTFLoader().load('./assets/meja-mini.glb',g=>{model=g.scene;modelReady=true;scene.add(model);say('Pratinjau siap. Seret untuk memutar atau mulai AR.');},undefined,e=>{console.error(e);modelFailed=true;say('Model GLB gagal dimuat. Pastikan assets/meja-mini.glb ada di folder publikasi.');});
checkSupport();
window.setTimeout(()=>{if(!modelReady&&!modelFailed)say('Model masih menunggu unduhan. Periksa apakah URL /assets/meja-mini.glb dapat dibuka.');},12000);

async function checkSupport(){
  if(!navigator.xr){button.textContent='WebXR tidak tersedia';say('Mode WebXR memerlukan browser Android yang mendukung AR dan halaman HTTPS.');return;}
  try{const ok=await navigator.xr.isSessionSupported('immersive-ar');button.disabled=!ok;button.textContent=ok?'Mulai AR':'Perangkat belum mendukung WebXR AR';if(ok)say(modelReady?'Siap. Mulai AR, pindai lantai, lalu ketuk untuk menempatkan meja.':'WebXR didukung. Sedang memuat model GLB…');}
  catch(e){console.warn(e);button.textContent='Dukungan AR tidak dapat diperiksa';}
}

async function beginAR(){
  if(session){await session.end();return;}
  button.disabled=true;say('Memulai sesi AR…');
  try{
    const s=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test'],optionalFeatures:['local-floor','dom-overlay'],domOverlay:{root:document.body}});
    session=s;await renderer.xr.setSession(s);
    const viewerSpace=await s.requestReferenceSpace('viewer');hitSource=await s.requestHitTestSource({space:viewerSpace});
    s.addEventListener('select',placeModel);s.addEventListener('end',endAR,{once:true});
    model.visible=false;floor.visible=false;grid.visible=false;reticle.visible=false;
    button.textContent='Keluar dari AR';button.disabled=false;say('Pindai lantai perlahan. Ketuk setelah reticle terlihat.');
  }catch(e){console.error(e);say(`AR gagal dimulai: ${e.message||e}. Coba Chrome Android, HTTPS, dan perangkat ARCore.`);button.disabled=false;button.textContent='Coba mulai AR lagi';}
}

function placeModel(){
  if(!reticle.visible||!model){say('Bidang belum terdeteksi. Pindai lantai perlahan.');return;}
  if(placed)scene.remove(placed);placed=model.clone(true);reticle.matrix.decompose(placed.position,placed.quaternion,placed.scale);scene.add(placed);say('Meja ditempatkan. Ketuk lagi untuk memindahkan objek.');
}
function endAR(){
  if(hitSource)hitSource.cancel();hitSource=null;session=null;reticle.visible=false;floor.visible=true;grid.visible=true;if(model)model.visible=true;if(placed)scene.remove(placed);placed=null;button.textContent='Mulai AR';button.disabled=false;say('Sesi AR berakhir. Anda dapat memulai sesi baru.');
}
button.addEventListener('click',beginAR);

renderer.setAnimationLoop((time,frame)=>{
  if(frame&&hitSource){const hits=frame.getHitTestResults(hitSource);if(hits.length){const pose=hits[0].getPose(renderer.xr.getReferenceSpace());if(pose){reticle.visible=true;reticle.matrix.fromArray(pose.transform.matrix);}}else reticle.visible=false;}
  if(!renderer.xr.isPresenting)controls.update();renderer.render(scene,camera);
});
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(canvas);window.addEventListener('resize',resize);resize();
