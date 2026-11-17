'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, Camera, Layers, Sparkles, RotateCcw } from 'lucide-react';
import { formatIDR } from '@/lib/analytics-engine';

interface Wealth3DStudioProps {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  makananExpense: number;
  jajanExpense: number;
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFat: number;
}

type CameraPreset = 'overview' | 'cashflow' | 'nutrition' | 'top';
type FinishPreset = 'emerald' | 'gold' | 'lime';

// Pre-allocated module-scope math scratch objects (Zero GC in render loop)
const _targetCamPos = new THREE.Vector3(0, 4.2, 9.5);
const _targetLookAt = new THREE.Vector3(0, 1.1, 0);
const _currentLookAt = new THREE.Vector3(0, 1.1, 0);
const _dummyMatrix = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();
const _dummyScale = new THREE.Vector3();
const _dummyColor = new THREE.Color();

function createProceduralGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#090d0c';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(16, 185, 129, 0.16)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let i = 0; i <= 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function Wealth3DStudio({
  totalBalance,
  monthlyIncome,
  monthlyExpense,
  makananExpense,
  jajanExpense,
  dailyCalories,
  dailyProtein,
  dailyCarbs,
  dailyFat,
}: Wealth3DStudioProps) {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [finishPreset, setFinishPreset] = useState<FinishPreset>('emerald');
  const [explodedRatio, setExplodedRatio] = useState<number>(0);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  // Store mutable props in ref so React HUD updates never tear down WebGL
  const stateRef = useRef({
    cameraPreset,
    finishPreset,
    explodedRatio,
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    makananExpense,
    jajanExpense,
    dailyCalories,
    dailyProtein,
    dailyCarbs,
    dailyFat,
  });

  useEffect(() => {
    stateRef.current = {
      cameraPreset,
      finishPreset,
      explodedRatio,
      totalBalance,
      monthlyIncome,
      monthlyExpense,
      makananExpense,
      jajanExpense,
      dailyCalories,
      dailyProtein,
      dailyCarbs,
      dailyFat,
    };
  }, [
    cameraPreset,
    finishPreset,
    explodedRatio,
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    makananExpense,
    jajanExpense,
    dailyCalories,
    dailyProtein,
    dailyCarbs,
    dailyFat,
  ]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 580;

    const scene = new THREE.Scene();
    const horizonColor = new THREE.Color(0x070b0a);
    scene.background = horizonColor;
    scene.fog = new THREE.FogExp2(0x070b0a, 0.035);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 120);
    camera.position.set(0, 4.2, 9.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Mandatory Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 3. Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x091410, 0.85);
    hemiLight.position.set(0, 15, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
    keyLight.position.set(6, 10, 7);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 28;
    const d = 8;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x10b981, 1.35);
    rimLight.position.set(-7, 5, -6);
    scene.add(rimLight);

    // 4. Ground Floor + Contact Shadow Grounding
    const gridTex = createProceduralGridTexture(renderer.capabilities.getMaxAnisotropy());
    const floorGeo = new THREE.PlaneGeometry(48, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: gridTex,
      roughness: 0.78,
      metalness: 0.18,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = !isSoftwareGl;
    scene.add(floorMesh);

    const contactShadowGeo = new THREE.CircleGeometry(4.6, 32);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.015;
    scene.add(contactShadow);

    // 5. Shared PBR Materials (Varied roughness >= 0.25 across adjacent parts)
    const darkTitaniumMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.88,
      roughness: 0.24,
    });
    const matteSlateMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.35,
      roughness: 0.72,
    });
    const accentCoreMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      metalness: 0.2,
      roughness: 0.12,
      clearcoat: 1.0,
      transmission: isSoftwareGl ? 0 : 0.82,
      transparent: true,
      opacity: isSoftwareGl ? 0.88 : 1.0,
      ior: 1.6,
    });
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.94,
      roughness: 0.18,
    });
    const incomeMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.65,
      roughness: 0.22,
    });
    const expenseMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      metalness: 0.65,
      roughness: 0.25,
    });
    const jajanMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.6,
      roughness: 0.28,
    });
    const macroCyanMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.55,
      roughness: 0.2,
    });

    // 6. Hero Composite Subject 1: Central Wealth Vault Gyroscope (8-part THREE.Group, bottom-pivoted at y=0)
    const vaultGroup = new THREE.Group();
    vaultGroup.position.set(0, 0, 0);
    scene.add(vaultGroup);

    // Part 1: Octagonal stepped base plinth
    const basePlinth = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.75, 0.28, 8), matteSlateMat);
    basePlinth.position.y = 0.14;
    basePlinth.castShadow = !isSoftwareGl;
    basePlinth.receiveShadow = !isSoftwareGl;
    vaultGroup.add(basePlinth);

    // Part 2: Lathe-turned metallic pedestal collar
    const lathePoints = [
      new THREE.Vector2(0.9, 0),
      new THREE.Vector2(1.25, 0.12),
      new THREE.Vector2(1.05, 0.34),
      new THREE.Vector2(0.75, 0.45),
    ];
    const latheCollar = new THREE.Mesh(new THREE.LatheGeometry(lathePoints, 24), darkTitaniumMat);
    latheCollar.position.y = 0.28;
    vaultGroup.add(latheCollar);

    // Part 3: Golden Chapter Ring
    const chapterRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.045, 16, 48), goldTrimMat);
    chapterRing.rotation.x = Math.PI / 2;
    chapterRing.position.y = 0.56;
    vaultGroup.add(chapterRing);

    // Part 4: Outer Gimbal Ring
    const outerGimbal = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.055, 16, 48), darkTitaniumMat);
    outerGimbal.position.y = 1.95;
    vaultGroup.add(outerGimbal);

    // Part 5: Inner Gimbal Ring
    const innerGimbal = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.04, 16, 40), goldTrimMat);
    innerGimbal.position.y = 1.95;
    vaultGroup.add(innerGimbal);

    // Part 6: Central Faceted Wealth Crystal
    const crystalCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 1), accentCoreMat);
    crystalCore.position.y = 1.95;
    crystalCore.castShadow = !isSoftwareGl;
    vaultGroup.add(crystalCore);

    // Part 7: Upper Crown Finial
    const crownCap = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.32, 6), darkTitaniumMat);
    crownCap.position.y = 3.25;
    vaultGroup.add(crownCap);

    // 7. InstancedMesh: 36 Procedural Wealth Coin Nodes orbiting the floor ring (>20 repeated items)
    const coinCount = 36;
    const coinGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.05, 16);
    const coinInstanced = new THREE.InstancedMesh(coinGeo, goldTrimMat, coinCount);
    for (let i = 0; i < coinCount; i++) {
      const angle = (i / coinCount) * Math.PI * 2;
      const radius = 3.65 + (i % 2) * 0.28;
      _dummyPos.set(Math.cos(angle) * radius, 0.04 + (i % 3) * 0.03, Math.sin(angle) * radius);
      _dummyQuat.setFromEuler(new THREE.Euler(0, -angle, 0));
      const scaleVar = 0.88 + (i % 4) * 0.08;
      _dummyScale.set(scaleVar, 1, scaleVar);
      _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
      coinInstanced.setMatrixAt(i, _dummyMatrix);
      _dummyColor.setHex(i % 3 === 0 ? 0x10b981 : i % 2 === 0 ? 0xfacc15 : 0x38bdf8);
      coinInstanced.setColorAt(i, _dummyColor);
    }
    coinInstanced.instanceMatrix.needsUpdate = true;
    if (coinInstanced.instanceColor) coinInstanced.instanceColor.needsUpdate = true;
    coinInstanced.computeBoundingSphere();
    scene.add(coinInstanced);

    // 8. Composite Subject 2: Left Cash-Flow Pillar Group (Income, Makanan, Jajan 5-part assemblies)
    function createPillarAssembly(x: number, z: number, barMat: THREE.Material) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.16, 0.76), matteSlateMat);
      foot.position.y = 0.08;
      group.add(foot);

      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.14, 16), darkTitaniumMat);
      collar.position.y = 0.22;
      group.add(collar);

      // Dynamic bar mesh pivoted at bottom
      const barGeo = new THREE.CylinderGeometry(0.26, 0.26, 1.0, 20);
      barGeo.translate(0, 0.5, 0);
      const barMesh = new THREE.Mesh(barGeo, barMat);
      barMesh.position.y = 0.29;
      barMesh.castShadow = !isSoftwareGl;
      group.add(barMesh);

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 20), goldTrimMat);
      cap.position.y = 1.35;
      group.add(cap);

      scene.add(group);
      return { group, barMesh, cap };
    }

    const incomePillar = createPillarAssembly(-2.6, -0.4, incomeMat);
    const expensePillar = createPillarAssembly(-1.7, -1.2, expenseMat);
    const jajanPillar = createPillarAssembly(-2.8, 0.85, jajanMat);

    // Right-side Nutrition Macro Towers (Protein, Carbs, Fat)
    const proteinPillar = createPillarAssembly(2.5, -0.6, macroCyanMat);
    const carbsPillar = createPillarAssembly(1.75, -1.2, incomeMat);
    const fatPillar = createPillarAssembly(2.7, 0.75, jajanMat);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 9. Paced Render Loop with Software WebGL Guard & Exponential Damping
    const startTimeMs = performance.now();
    let prevTimeMs = startTimeMs;
    let frameId = 0;
    let isDisposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const nowMs = performance.now();
      const dt = Math.min((nowMs - prevTimeMs) / 1000, 0.1);
      prevTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) / 1000;
      const st = stateRef.current;

      // Update finish color based on preset
      const targetHex =
        st.finishPreset === 'emerald' ? 0x10b981 : st.finishPreset === 'gold' ? 0xfacc15 : 0xa3e635;
      _dummyColor.setHex(targetHex);
      accentCoreMat.color.lerp(_dummyColor, 1 - Math.exp(-6 * dt));

      // Camera target based on preset
      if (st.cameraPreset === 'overview') {
        _targetCamPos.set(0, 4.1, 9.2);
        _targetLookAt.set(0, 1.35, 0);
      } else if (st.cameraPreset === 'cashflow') {
        _targetCamPos.set(-3.2, 3.2, 6.2);
        _targetLookAt.set(-2.1, 1.2, -0.2);
      } else if (st.cameraPreset === 'nutrition') {
        _targetCamPos.set(3.2, 3.2, 6.2);
        _targetLookAt.set(2.1, 1.2, -0.2);
      } else {
        _targetCamPos.set(0, 9.5, 2.2);
        _targetLookAt.set(0, 0.5, 0);
      }

      const dampFactor = 1 - Math.exp(-5 * dt);
      camera.position.lerp(_targetCamPos, dampFactor);
      _currentLookAt.lerp(_targetLookAt, dampFactor);
      camera.lookAt(_currentLookAt);

      // Animate central vault gyroscope & exploded view separation
      const explodeOffset = st.explodedRatio * 1.1;
      outerGimbal.rotation.y = elapsed * 0.55;
      outerGimbal.rotation.x = Math.sin(elapsed * 0.4) * 0.25;
      innerGimbal.rotation.x = elapsed * 0.75;
      innerGimbal.rotation.z = Math.cos(elapsed * 0.5) * 0.35;
      crystalCore.rotation.y = -elapsed * 0.65;
      crystalCore.position.y = THREE.MathUtils.damp(
        crystalCore.position.y,
        1.95 + explodeOffset * 0.45 + Math.sin(elapsed * 1.8) * 0.06,
        6,
        dt
      );
      crownCap.position.y = THREE.MathUtils.damp(
        crownCap.position.y,
        3.25 + explodeOffset * 1.05,
        6,
        dt
      );
      chapterRing.position.y = THREE.MathUtils.damp(
        chapterRing.position.y,
        0.56 + explodeOffset * 0.2,
        6,
        dt
      );

      // Scale financial & nutrition pillars smoothly from real data
      const maxFin = Math.max(1000000, st.monthlyIncome, st.monthlyExpense);
      const incScale = Math.max(0.25, Math.min(2.8, (st.monthlyIncome / maxFin) * 2.4));
      const expScale = Math.max(0.25, Math.min(2.8, (st.monthlyExpense / maxFin) * 2.4));
      const jajScale = Math.max(0.2, Math.min(2.4, (st.jajanExpense / maxFin) * 2.4));

      incomePillar.barMesh.scale.y = THREE.MathUtils.damp(incomePillar.barMesh.scale.y, incScale, 5, dt);
      incomePillar.cap.position.y = 0.34 + incomePillar.barMesh.scale.y + explodeOffset * 0.3;

      expensePillar.barMesh.scale.y = THREE.MathUtils.damp(expensePillar.barMesh.scale.y, expScale, 5, dt);
      expensePillar.cap.position.y = 0.34 + expensePillar.barMesh.scale.y + explodeOffset * 0.3;

      jajanPillar.barMesh.scale.y = THREE.MathUtils.damp(jajanPillar.barMesh.scale.y, jajScale, 5, dt);
      jajanPillar.cap.position.y = 0.34 + jajanPillar.barMesh.scale.y + explodeOffset * 0.3;

      const protScale = Math.max(0.25, Math.min(2.5, (st.dailyProtein / 120) * 1.9));
      const carbScale = Math.max(0.25, Math.min(2.5, (st.dailyCarbs / 250) * 1.9));
      const fatScale = Math.max(0.25, Math.min(2.5, (st.dailyFat / 80) * 1.9));

      proteinPillar.barMesh.scale.y = THREE.MathUtils.damp(proteinPillar.barMesh.scale.y, protScale, 5, dt);
      proteinPillar.cap.position.y = 0.34 + proteinPillar.barMesh.scale.y + explodeOffset * 0.3;

      carbsPillar.barMesh.scale.y = THREE.MathUtils.damp(carbsPillar.barMesh.scale.y, carbScale, 5, dt);
      carbsPillar.cap.position.y = 0.34 + carbsPillar.barMesh.scale.y + explodeOffset * 0.3;

      fatPillar.barMesh.scale.y = THREE.MathUtils.damp(fatPillar.barMesh.scale.y, fatScale, 5, dt);
      fatPillar.cap.position.y = 0.34 + fatPillar.barMesh.scale.y + explodeOffset * 0.3;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container || isDisposed) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 580;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      gridTex.dispose();
      envTexture.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      contactShadowGeo.dispose();
      contactShadowMat.dispose();
      coinGeo.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-[560px] lg:h-[640px] rounded-2xl overflow-hidden border border-neutral-800 bg-[#070b0a]">
      {/* Dedicated WebGL Mount Container outside React HUD siblings */}
      <div
        ref={canvasMountRef}
        data-testid="wealth-3d-canvas"
        className="w-full h-full"
      />

      {/* Minimal Top-Left Spec Title (Zero Center Viewport Occlusion) */}
      <div className="pointer-events-none absolute top-4 left-4 z-10 bg-neutral-950/90 border border-neutral-800 rounded-xl px-4 py-2.5">
        <div className="text-xs font-medium text-emerald-400">
          3D Spatial Financial &amp; Macro Vault
        </div>
        <div className="text-base font-bold text-white font-mono tabular-nums mt-0.5">
          {formatIDR(totalBalance)}
        </div>
        <div className="text-[11px] text-neutral-400 font-mono tabular-nums">
          Pemasukan {formatIDR(monthlyIncome)} · Pengeluaran {formatIDR(monthlyExpense)} · {Math.round(dailyCalories)} kkal
        </div>
      </div>

      {/* Collapsible Unified Bottom Control Dock (<= 15% Viewport Footprint, Solid rgba Surface) */}
      <div className="
        absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-[860px]
        flex flex-col items-center
      ">
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="mb-1.5 px-3.5 py-1 rounded-t-lg bg-neutral-900/95 border border-neutral-700 text-xs font-medium text-neutral-200 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tampilkan Kontrol 3D</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sembunyikan Kontrol (Mode Sinema)</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="w-full bg-neutral-950/95 border border-neutral-800 rounded-xl px-4 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-4">
            {/* Camera Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-400 flex items-center gap-1 mr-1">
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                Kamera:
              </span>
              {(
                [
                  { id: 'overview', label: 'Utama' },
                  { id: 'cashflow', label: 'Arus Kas' },
                  { id: 'nutrition', label: 'Makro Nutrisi' },
                  { id: 'top', label: 'Atas' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setCameraPreset(preset.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    cameraPreset === preset.id
                      ? 'bg-emerald-500 text-neutral-950 font-semibold'
                      : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Exploded View Slider */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="exploded-slider"
                className="text-xs text-neutral-400 flex items-center gap-1 whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Exploded View:
              </label>
              <input
                id="exploded-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={explodedRatio}
                onChange={(e) => setExplodedRatio(Number(e.target.value))}
                className="w-24 accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Material Finish Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-400 flex items-center gap-1 mr-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Material:
              </span>
              {(
                [
                  { id: 'emerald', label: 'Emerald' },
                  { id: 'gold', label: 'Gold' },
                  { id: 'lime', label: 'Lime' },
                ] as const
              ).map((mat) => (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => setFinishPreset(mat.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    finishPreset === mat.id
                      ? 'bg-neutral-100 text-neutral-950 font-semibold'
                      : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  {mat.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setCameraPreset('overview');
                  setExplodedRatio(0);
                  setFinishPreset('emerald');
                }}
                aria-label="Reset Tampilan 3D"
                className="p-1.5 rounded-md bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
