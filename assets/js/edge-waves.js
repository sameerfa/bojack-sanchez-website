/**
 * Neural Network Edge Animation using Three.js
 * Creates neuron-like connections transferring information between edges
 */

class EdgeWaveAnimation {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.connections = [];
    this.animationId = null;
    this.time = 0;
    
    this.init();
  }

  init() {
    // Check if Three.js is available
    if (typeof THREE === 'undefined') {
      console.warn('Three.js not loaded');
      return;
    }

    // Create container for the edge wave canvas
    let container = document.getElementById('edge-wave-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'edge-wave-container';
      document.body.appendChild(container);
    }
    
    console.log('EdgeWaveAnimation: Initializing neural network...');

    // Set up scene
    this.scene = new THREE.Scene();
    
    // Set up camera (orthographic for 2D effect)
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      -width / 2, width / 2,
      height / 2, -height / 2,
      1, 1000
    );
    this.camera.position.z = 100;

    // Set up renderer with low opacity
    this.renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      powerPreference: 'low-power'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const canvas = this.renderer.domElement;
    canvas.style.margin = '0';
    canvas.style.padding = '0';
    canvas.style.display = 'block';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    // Create neural connections
    this.createNeuralConnections();
    console.log('EdgeWaveAnimation: Created', this.connections.length, 'neural connections');

    // Handle resize
    window.addEventListener('resize', () => this.handleResize());

    // Start animation
    this.animate();
    console.log('EdgeWaveAnimation: Animation started');
  }

  createNeuralConnections() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const edgeThickness = 50; // Thinner edge zones
    const connectionCount = 8; // Fewer connections for subtlety

    // Define edge zones
    const edges = {
      top: { x: 0, y: height / 2 - edgeThickness / 2, w: width, h: edgeThickness },
      bottom: { x: 0, y: -height / 2 + edgeThickness / 2, w: width, h: edgeThickness },
      left: { x: -width / 2 + edgeThickness / 2, y: 0, w: edgeThickness, h: height },
      right: { x: width / 2 - edgeThickness / 2, y: 0, w: edgeThickness, h: height }
    };

    // Create connections between different edges
    const edgePairs = [
      ['top', 'bottom'],
      ['top', 'left'],
      ['top', 'right'],
      ['bottom', 'left'],
      ['bottom', 'right'],
      ['left', 'right']
    ];

    for (let i = 0; i < connectionCount; i++) {
      // Random edge pair
      const pair = edgePairs[Math.floor(Math.random() * edgePairs.length)];
      const fromEdge = edges[pair[0]];
      const toEdge = edges[pair[1]];

      // Random start and end points on edges
      let fromX, fromY, toX, toY;

      if (pair[0] === 'top') {
        fromX = -width / 2 + Math.random() * width;
        fromY = height / 2 - edgeThickness / 2;
      } else if (pair[0] === 'bottom') {
        fromX = -width / 2 + Math.random() * width;
        fromY = -height / 2 + edgeThickness / 2;
      } else if (pair[0] === 'left') {
        fromX = -width / 2 + edgeThickness / 2;
        fromY = height / 2 - Math.random() * height;
      } else { // right
        fromX = width / 2 - edgeThickness / 2;
        fromY = height / 2 - Math.random() * height;
      }

      if (pair[1] === 'top') {
        toX = -width / 2 + Math.random() * width;
        toY = height / 2 - edgeThickness / 2;
      } else if (pair[1] === 'bottom') {
        toX = -width / 2 + Math.random() * width;
        toY = -height / 2 + edgeThickness / 2;
      } else if (pair[1] === 'left') {
        toX = -width / 2 + edgeThickness / 2;
        toY = height / 2 - Math.random() * height;
      } else { // right
        toX = width / 2 - edgeThickness / 2;
        toY = height / 2 - Math.random() * height;
      }

      // Create neural connection
      const connection = this.createNeuralConnection(
        fromX, fromY,
        toX, toY,
        i
      );
      this.connections.push(connection);
    }

    // Also create edge glow effects
    Object.keys(edges).forEach((edgeName, index) => {
      const edge = edges[edgeName];
      const glow = this.createEdgeGlow(
        edge.x, edge.y, edge.w, edge.h,
        edgeName,
        index * 0.5
      );
      this.connections.push(glow);
    });
  }

  createNeuralConnection(fromX, fromY, toX, toY, id) {
    // Calculate distance and create curve
    const distance = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
    const segments = Math.max(64, Math.floor(distance / 5));
    const width = 2; // Thinner connection width
    
    // Create curved path (bezier-like curve)
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const curveAmount = distance * 0.3;
    const perpX = -(toY - fromY) / distance;
    const perpY = (toX - fromX) / distance;
    const controlX = midX + perpX * curveAmount * (Math.random() > 0.5 ? 1 : -1);
    const controlY = midY + perpY * curveAmount * (Math.random() > 0.5 ? 1 : -1);

    // Create curve points
    const curvePoints = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      // Quadratic bezier curve
      const x = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * controlX + t * t * toX;
      const y = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * controlY + t * t * toY;
      curvePoints.push(new THREE.Vector3(x, y, 0));
    }

    // Create tube geometry along the curve
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const geometry = new THREE.TubeGeometry(curve, segments, width, 8, false);
    
    // Create shader material for neural pulse
    const phase = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 0.4;
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        phase: { value: phase },
        speed: { value: speed },
        id: { value: id }
      },
      vertexShader: `
        uniform float time;
        uniform float phase;
        uniform float speed;
        varying vec2 vUv;
        varying float vProgress;
        varying float vPulse;
        
        void main() {
          vUv = uv;
          vProgress = uv.x; // Progress along the tube (0 to 1)
          
          // Create pulsing effect traveling along the connection
          float pulsePos = mod(vProgress + time * speed + phase, 1.0);
          vPulse = sin(pulsePos * 3.14159) * 0.5 + 0.5;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        varying float vProgress;
        varying float vPulse;
        
        void main() {
          // Dark neural network color
          vec3 color = vec3(0.1, 0.25, 0.4); // Dark blue-gray
          
          // Pulse intensity - brightens as pulse travels
          float intensity = vPulse * 0.9 + 0.1;
          
          // Fade at connection endpoints
          float edgeFade = smoothstep(0.0, 0.15, vProgress) * smoothstep(1.0, 0.85, vProgress);
          
          // Brighten during pulse (like signal traveling)
          color = mix(color, vec3(0.15, 0.35, 0.55), vPulse * 0.5);
          
          // Radial fade from center of tube
          float radialFade = 1.0 - abs(vUv.y - 0.5) * 2.0;
          radialFade = smoothstep(0.3, 1.0, radialFade);
          
          float alpha = intensity * edgeFade * radialFade * 0.15;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);

    return { mesh, material };
  }

  createEdgeGlow(x, y, width, height, edge, phase) {
    const isHorizontal = edge === 'top' || edge === 'bottom';
    const segmentsX = Math.max(32, Math.floor(width / 10));
    const segmentsY = Math.max(32, Math.floor(height / 10));
    const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        edgeType: { value: isHorizontal ? 1.0 : 0.0 },
        phase: { value: phase },
        speed: { value: 0.5 + Math.random() * 0.3 }
      },
      vertexShader: `
        uniform float time;
        uniform float edgeType;
        uniform float phase;
        uniform float speed;
        varying vec2 vUv;
        varying float vFlow;
        
        void main() {
          vUv = uv;
          vec3 pos = position;
          
          // Subtle flow along edge
          if (edgeType > 0.5) {
            vFlow = sin(pos.x * 0.05 + time * speed + phase) * 0.5 + 0.5;
          } else {
            vFlow = sin(pos.y * 0.05 + time * speed + phase) * 0.5 + 0.5;
          }
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float edgeType;
        varying vec2 vUv;
        varying float vFlow;
        
        void main() {
          // Gradient fade from edge
          float dist = edgeType > 0.5 ? vUv.y : vUv.x;
          float fade = 1.0 - smoothstep(0.0, 1.0, dist);
          
          // Dark neural color
          vec3 color = vec3(0.1, 0.25, 0.4);
          color = mix(color, vec3(0.12, 0.3, 0.45), vFlow * 0.3);
          
          float alpha = fade * vFlow * 0.06;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x + width / 2, y - height / 2, 0);
    this.scene.add(mesh);

    return { mesh, material };
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    this.time += 0.02; // Faster animation
    
    // Update connection uniforms
    this.connections.forEach(({ material }) => {
      if (material && material.uniforms) {
        material.uniforms.time.value = this.time;
      }
    });

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    window.removeEventListener('resize', this.handleResize);
    
    if (this.renderer) {
      this.renderer.dispose();
      const container = document.getElementById('edge-wave-container');
      if (container) {
        container.remove();
      }
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new EdgeWaveAnimation();
  });
} else {
  new EdgeWaveAnimation();
}
