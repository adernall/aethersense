import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { AnalysisResult } from "../types";

export function SignalCloud({ analysis }: { analysis: AnalysisResult | null }) {
  const mount = useRef<HTMLDivElement | null>(null);
  const [webglAvailable, setWebglAvailable] = useState(true);

  useEffect(() => {
    if (!mount.current) return;
    const container = mount.current;
    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl") && !probe.getContext("experimental-webgl")) {
      setWebglAvailable(false);
      return;
    }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 28, 86);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebglAvailable(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);
    const material = new THREE.PointsMaterial({
      size: 2.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.86,
      depthWrite: false
    });

    const buildPoints = () => {
      group.clear();
      const cells = analysis?.heatmap?.length ? analysis.heatmap : [];
      const positions: number[] = [];
      const colors: number[] = [];
      cells.forEach((cell) => {
        const value = cell.value / 100;
        positions.push((cell.x - 50) * 0.9, value * 34 - 15, (cell.y - 50) * 0.55);
        const color = new THREE.Color(value > 0.7 ? "#ffaa35" : value > 0.45 ? "#42d9ff" : "#714eff");
        colors.push(color.r, color.g, color.b);
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      group.add(new THREE.Points(geometry, material));
    };
    buildPoints();

    const grid = new THREE.GridHelper(82, 16, "#2ee5e0", "#1a3e45");
    grid.position.y = -18;
    group.add(grid);

    let raf = 0;
    const animate = () => {
      group.rotation.y += 0.004;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const resize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      material.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [analysis, webglAvailable]);

  if (!webglAvailable) {
    const cells = analysis?.heatmap.slice(0, 36) ?? [];
    return (
      <div className="signal-cloud fallback-cloud" aria-label="Pseudo 3D signal cloud fallback">
        {cells.map((cell, index) => (
          <span
            key={`${cell.x}-${cell.y}-${index}`}
            style={{
              left: `${cell.x}%`,
              top: `${cell.y}%`,
              opacity: 0.22 + cell.confidence * 0.72,
              transform: `translate(-50%, -50%) scale(${0.7 + cell.value / 90})`
            }}
          />
        ))}
        <b>WebGL unavailable. 2D fallback active.</b>
      </div>
    );
  }

  return <div className="signal-cloud" ref={mount} aria-label="Pseudo 3D signal cloud" />;
}
