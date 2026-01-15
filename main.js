import * as THREE from 'three';
import {OrbitControls} from 'https://unpkg.com/three@0.142.0/examples/jsm/controls/OrbitControls.js';
import {FontLoader} from 'https://unpkg.com/three@0.142.0/examples/jsm/loaders/FontLoader.js';
import {TextGeometry} from 'https://unpkg.com/three@0.142.0/examples/jsm/geometries/TextGeometry.js';
import {GLTFLoader} from 'https://unpkg.com/three@0.142.0/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'https://unpkg.com/three@0.142.0/examples/jsm/loaders/DRACOLoader.js';
 
const canvas = document.querySelector('.webgl');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

const camera = new THREE.PerspectiveCamera(77, sizes.width / sizes.height, 0.1, 100);
camera.position.z = 13;
camera.position.y = 0;
scene.add(camera);

// ライトを追加
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

// 時計の数字を管理する配列
let bachelorDigitMeshes = [];
let masterDigitMeshes = [];
let bachelorUnitMeshes = [];
let masterUnitMeshes = [];
let bachelorTitleModel = null;
let masterTitleModel = null;
let animatingDigits = [];
let font = null;
let previousBachelorTime = '';
let previousMasterTime = '';

// 締め切り時刻
const bachelorDeadline = new Date('2026-02-09T17:00:00+09:00');
const masterDeadline = new Date('2026-02-13T15:00:00+09:00');

// GLTFローダーを初期化
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
gltfLoader.setDRACOLoader(dracoLoader);

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// OrbitControlsを追加
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
let modelsLoaded = false;
let fontLoaded = false;

const fontLoader = new FontLoader();

fontLoader.load(
    'https://unpkg.com/three@0.142.0/examples/fonts/helvetiker_bold.typeface.json',
    (loadedFont) => {
        font = loadedFont;
        fontLoaded = true;
        checkAndStart();
    }
);

// GLBモデルを読み込み
gltfLoader.load(
    './models/sotsuron.glb',
    (gltf) => {
        bachelorTitleModel = gltf.scene;
        bachelorTitleModel.position.set(-7.5, 7.5, 0);
        bachelorTitleModel.rotation.x = Math.PI * 0.5;
        bachelorTitleModel.scale.set(2, 2, 2);
        
        // モデルの全メッシュにマテリアルを適用
        bachelorTitleModel.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0xff6b6b,
                    metalness: 0.3,
                    roughness: 0.4
                });
            }
        });
        
        scene.add(bachelorTitleModel);
        checkModelsLoaded();
    },
    undefined,
    (error) => {
        console.error('卒論モデルの読み込みエラー:', error);
    }
);

gltfLoader.load(
    './models/shuuron.glb',
    (gltf) => {
        masterTitleModel = gltf.scene;
        masterTitleModel.position.set(-7, 1.5, 0);
        masterTitleModel.scale.set(2, 2, 2);
        masterTitleModel.rotation.x = Math.PI * 0.5;
        
        // モデルの全メッシュにマテリアルを適用
        masterTitleModel.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0x4ecdc4,
                    metalness: 0.3,
                    roughness: 0.4
                });
            }
        });
        
        scene.add(masterTitleModel);
        checkModelsLoaded();
    },
    undefined,
    (error) => {
        console.error('修論モデルの読み込みエラー:', error);
    }
);

function checkModelsLoaded() {
    if (bachelorTitleModel && masterTitleModel) {
        modelsLoaded = true;
        checkAndStart();
    }
}

function checkAndStart() {
    if (fontLoaded && modelsLoaded) {
        updateClock();
    }
}


// 残り時間を計算
function getTimeRemaining(deadline) {
    const now = new Date();
    const distance = deadline.getTime() - now.getTime();
    
    if (distance < 0) {
        return '00:00:00:00';
    }
    
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    
    return `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// 時計を作成・更新する関数
function updateClock() {
    const bachelorTimeString = getTimeRemaining(bachelorDeadline);
    const masterTimeString = getTimeRemaining(masterDeadline);
    
    // 卒論タイマーを更新
    updateTimer(bachelorTimeString, previousBachelorTime, bachelorDigitMeshes, 5);
    previousBachelorTime = bachelorTimeString;
    
    // 修論タイマーを更新
    updateTimer(masterTimeString, previousMasterTime, masterDigitMeshes, -5);
    previousMasterTime = masterTimeString;
}

// 個別のタイマーを更新
function updateTimer(timeString, previousTime, digitMeshes, yPos) {
    // 初回または時刻が変わった場合
    if (previousTime !== timeString) {
        const chars = timeString.split('');
        const previousChars = previousTime.split('');
        const spacing = 1.8;
        const startX = -(chars.length * spacing) / 2;
        
        // 初回の場合はすべて作成
        if (digitMeshes.length === 0) {
            chars.forEach((char, index) => {
                createDigit(char, startX + index * spacing, yPos, index, digitMeshes);
            });
            
            // 単位も作成（初回のみ）
            const unitMeshes = yPos > 0 ? bachelorUnitMeshes : masterUnitMeshes;
            createUnits(startX, yPos, spacing, unitMeshes);
        } else {
            // 変更された文字だけアニメーション
            chars.forEach((char, index) => {
                if (char !== previousChars[index]) {
                    // 古い数字を落下させる
                    const oldMesh = digitMeshes[index];
                    // 落ちる数字を赤色に変更
                    oldMesh.material.color.setHex(0xff0000);
                    if (oldMesh) {
                        animatingDigits.push({
                            mesh: oldMesh,
                            type: 'falling',
                            progress: 0
                        });
                    }
                    
                    // 新しい数字を作成
                    createDigit(char, startX + index * spacing, yPos + 15, index, digitMeshes);
                    
                    // 新しい数字を降下させる
                    const newMesh = digitMeshes[index];
                    animatingDigits.push({
                        mesh: newMesh,
                        type: 'dropping',
                        progress: 0,
                        targetY: yPos
                    });
                }
            });
        }
    }
}

// 単位を作成（day, hour, min, sec）
function createUnits(startX, yPos, spacing, unitMeshes) {
    const units = ['day', 'hour', 'min', 'sec'];
    // 形式: DD:HH:MM:SS (11文字)
    // 位置: 0-1(day), 3-4(hour), 6-7(min), 9-10(sec)
    const positions = [0.5, 3.5, 6.5, 9.5]; // 各ペアの中心位置
    
    units.forEach((unit, i) => {
        const unitX = startX + positions[i] * spacing;
        const unitY = yPos - 1.8;
        
        const textGeometry = new TextGeometry(unit, {
            font: font,
            size: 0.5,
            height: 0.1,
            curveSegments: 8,
            bevelEnabled: true,
            bevelThickness: 0.01,
            bevelSize: 0.01,
            bevelOffset: 0,
            bevelSegments: 3
        });
        
        textGeometry.center();
        
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xaaaaaa,
            metalness: 0.2,
            roughness: 0.5
        });
        
        const mesh = new THREE.Mesh(textGeometry, material);
        mesh.position.x = unitX;
        mesh.position.y = unitY;
        mesh.position.z = 0;
        
        scene.add(mesh);
        unitMeshes.push(mesh);
    });
}

// 個別の数字を作成
function createDigit(char, x, y, index, digitMeshes) {
    const textGeometry = new TextGeometry(char, {
        font: font,
        size: 2,
        height: 0.5,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.02,
        bevelOffset: 0,
        bevelSegments: 5
    });
    
    textGeometry.center();
    
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        metalness: 0.3,
        roughness: 0.4
    });
    
    const mesh = new THREE.Mesh(textGeometry, material);
    mesh.position.x = x;
    mesh.position.y = y;
    mesh.position.z = 0;
    
    scene.add(mesh);
    digitMeshes[index] = mesh;
    
    return mesh;
}

// アニメーションループ
function animate() {
    requestAnimationFrame(animate);
    
    // 時計を更新
    if (font) {
        updateClock();
    }
    
    // アニメーション中の数字を更新
    animatingDigits = animatingDigits.filter(item => {
        item.progress += 0.05;
        
        if (item.type === 'falling') {
            // 古い数字を落とす
            item.mesh.position.y -= item.progress * 0.3;
            item.mesh.rotation.x += 0.1;
            item.mesh.rotation.z += 0.05;
            
            // 落下完了
            if (item.progress > 1.5) {
                scene.remove(item.mesh);
                item.mesh.geometry.dispose();
                item.mesh.material.dispose();
                return false;
            }
        } else if (item.type === 'dropping') {
            // 新しい数字を降ろす
            const easeOut = 1 - Math.pow(1 - Math.min(item.progress, 1), 3);
            const startY = item.mesh.position.y;
            const targetY = item.targetY;
            item.mesh.position.y = startY - ((startY - targetY) * easeOut);
            item.mesh.rotation.x = (1 - easeOut) * Math.PI * 2;
            
            // 降下完了
            if (item.progress >= 1) {
                item.mesh.position.y = targetY;
                item.mesh.rotation.x = 0;
                return false;
            }
        }
        
        return true;
    });
    
    controls.update();
    renderer.render(scene, camera);
}

animate();

// ウィンドウリサイズ対応
window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});