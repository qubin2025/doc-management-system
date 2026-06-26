
import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { Node, Link, ThemeType, RelationType } from '../types';

interface RelationshipGraphProps {
  nodes: Node[];
  links: Link[];
  selectedNodeId: string | null;
  onNodeClick: (node: any) => void;
  theme: ThemeType;
  t: any;
}

const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ nodes, links, selectedNodeId, onNodeClick, theme, t }) => {
  const fgRef = useRef<any>(null);

  const graphData = useMemo(() => {
    return {
      nodes: nodes.map(n => ({ ...n })),
      links: links.map(l => ({ ...l }))
    };
  }, [nodes, links]);

  // 主题配置：包含背景渐变、主光颜色、环境光强度和雾气
  const themeConfig = useMemo(() => {
    switch (theme) {
      case 'dusk':
        return { 
          gradient: 'radial-gradient(circle at center, #2e1065 0%, #030712 100%)',
          bgHex: '#030712',
          mainLight: '#fb923c', 
          ambIntensity: 0.6,
          fog: '#030712'
        };
      case 'starlight':
        return { 
          gradient: 'radial-gradient(circle at center, #1e1b4b 0%, #020617 100%)',
          bgHex: '#020617',
          mainLight: '#e0f2fe', 
          ambIntensity: 0.3,
          fog: '#020617'
        };
      case 'dawn':
        return { 
          gradient: 'radial-gradient(circle at center, #0c4a6e 0%, #082f49 100%)',
          bgHex: '#082f49',
          mainLight: '#fde68a', 
          ambIntensity: 0.7,
          fog: '#082f49'
        };
      case 'moonlight':
        return { 
          gradient: 'radial-gradient(circle at center, #f3f4f6 0%, #e5e7eb 50%, #9ca3af 100%)',
          bgHex: '#f3f4f6',
          mainLight: '#ffffff', 
          ambIntensity: 0.9,
          fog: '#f3f4f6'
        };
      case 'space':
      default:
        return { 
          gradient: 'radial-gradient(circle at center, #111827 0%, #000000 100%)',
          bgHex: '#000000',
          mainLight: '#6366f1', 
          ambIntensity: 0.2,
          fog: '#000000'
        };
    }
  }, [theme]);

  // 初始化场景灯光和雾气
  useEffect(() => {
    if (fgRef.current) {
      const scene = fgRef.current.scene();
      
      // 动态雾气增强纵深感
      scene.fog = new THREE.FogExp2(themeConfig.fog, 0.0008);
      
      // 清理旧灯光
      scene.children = scene.children.filter((c: any) => !c.userData.isCustomLight);
      
      // 1. 主点光源：模拟 3D 光影，产生高光
      const mainLight = new THREE.PointLight(themeConfig.mainLight, 3, 1500);
      mainLight.position.set(100, 100, 100);
      mainLight.userData.isCustomLight = true;
      scene.add(mainLight);

      // 2. 环境光：控制整体明暗基础
      const ambLight = new THREE.AmbientLight(themeConfig.mainLight, themeConfig.ambIntensity);
      ambLight.userData.isCustomLight = true;
      scene.add(ambLight);

      // 3. 辅助侧光：增强轮廓
      const rimLight = new THREE.DirectionalLight('#ffffff', 0.4);
      rimLight.position.set(-100, -50, -100);
      rimLight.userData.isCustomLight = true;
      scene.add(rimLight);
    }
  }, [themeConfig]);

  // 相机平滑跟随
  useEffect(() => {
    if (selectedNodeId && fgRef.current) {
      const timeout = setTimeout(() => {
        const graphNode = graphData.nodes.find((n: any) => n.id === selectedNodeId) as any;
        if (graphNode && typeof graphNode.x === 'number') {
          const { x, y, z } = graphNode;
          const distance = 180;
          const distRatio = 1 + distance / Math.hypot(x, y, z);
          
          if (fgRef.current && typeof fgRef.current.cameraPosition === 'function') {
            fgRef.current.cameraPosition(
              { x: x * distRatio, y: y * distRatio, z: z * distRatio },
              graphNode,
              1200
            );
          }
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [selectedNodeId, graphData.nodes]);

  const getCategoryColor = useCallback((cat: string) => {
    switch (cat) {
      case 'Tech': return '#0ea5e9'; // 深青
      case 'Design': return '#ec4899'; // 玫红
      case 'Business': return '#eab308'; // 金黄
      case 'Social': return '#8b5cf6'; // 靓紫
      default: return '#6366f1';
    }
  }, []);

  const getLinkColor = (type: RelationType) => {
    if (type.startsWith('Work')) return '#3b82f6'; // 蓝色系 - 工作
    if (type.startsWith('Family')) return '#ef4444'; // 红色系 - 家庭
    if (type === 'Friend') return '#22c55e'; // 绿色系 - 朋友
    return '#94a3b8'; // 灰色 - 其他
  };

  const nodeThreeObject = useCallback((node: any) => {
    if (!node) return new THREE.Object3D();
    
    const isSelected = node.id === selectedNodeId;
    const color = getCategoryColor(node.category);
    const size = (node.weight || 5) * 0.9;

    const group = new THREE.Group();

    // 1. 核心球体 - 使用 MeshStandardMaterial 以响应点光源
    const coreMat = new THREE.MeshStandardMaterial({
      color: isSelected ? '#ffffff' : color,
      emissive: color,
      emissiveIntensity: isSelected ? 0.8 : 0.3,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.95,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(size, 32, 32), coreMat);
    group.add(core);

    // 2. 边缘光晕层 - 增强立体感
    const rimMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide
    });
    const rim = new THREE.Mesh(new THREE.SphereGeometry(size * 1.3, 32, 32), rimMat);
    group.add(rim);

    // 3. 姓名标签 - SpriteText
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const fontSize = 44;
      ctx.font = `Bold ${fontSize}px "Inter", sans-serif`;
      const textWidth = ctx.measureText(node.name).width;
      canvas.width = textWidth + 60;
      canvas.height = fontSize + 40;

      ctx.font = `Bold ${fontSize}px "Inter", sans-serif`;
      ctx.fillStyle = isSelected ? '#ffffff' : '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 文字发光阴影
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 15 : 5;
      ctx.fillText(node.name, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      
      sprite.position.set(0, size + 10, 0);
      const aspect = canvas.width / canvas.height;
      sprite.scale.set(7 * aspect, 7, 1);
      
      group.add(sprite);
    }

    return group;
  }, [selectedNodeId, getCategoryColor]);

  return (
    <div 
      className="absolute inset-0 w-full h-full transition-all duration-1000" 
      style={{ background: themeConfig.gradient }}
    >
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)" // 设为透明以显示容器渐变背景
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkWidth={(link: any) => (link.strength || 2) / 6}
        linkColor={(link: any) => getLinkColor(link.type)}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={(link: any) => (link.strength || 1) * 0.002}
        linkDirectionalParticleWidth={1.4}
        linkDirectionalParticleColor={() => '#ffffff'}
        onNodeClick={onNodeClick}
        showNavInfo={false}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.3}
      />
    </div>
  );
};

export default RelationshipGraph;
