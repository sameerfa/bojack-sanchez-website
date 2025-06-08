class SoundWaveAnimation {
  constructor() {
    this.container = document.getElementById('canvas-container');
    
    // Only initialize Three.js if container exists and THREE is available
    if (!this.container || typeof THREE === 'undefined') {
      console.warn('Canvas container or Three.js not found');
      return;
    }

    // Determine canvas dimensions based on container
    this.updateDimensions();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.canvasWidth / this.canvasHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.waves = [];
    this.isHovered = false;

    this.init();
    this.animate();
    this.handleResize();
    this.setupEventListeners();
  }

  updateDimensions() {
    // Get the actual dimensions of the parent container
    const parentElement = this.container.parentElement;
    if (parentElement) {
      const rect = parentElement.getBoundingClientRect();
      this.canvasWidth = rect.width || window.innerWidth;
      this.canvasHeight = rect.height || 200;
    } else {
      this.canvasWidth = window.innerWidth;
      this.canvasHeight = 200;
    }
  }

  init() {
    this.renderer.setSize(this.canvasWidth, this.canvasHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    // Position camera further back to see more of the waves
    this.camera.position.z = 30;

    this.createWaves();
  }

  createWaves() {
    const waveCount = 3;
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1'];
    const sizes = [120, 130, 140];

    for (let i = 0; i < waveCount; i++) {
      const geometry = new THREE.PlaneGeometry(sizes[i], sizes[i], 164, 164);
      const material = new THREE.MeshPhongMaterial({
        color: colors[i],
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        wireframe: true,
        wireframeLinewidth: 1,
      });

      const wave = new THREE.Mesh(geometry, material);
      wave.position.z = -i * 8;
      wave.rotation.x = Math.PI / 2;

      this.waves.push({
        mesh: wave,
        vertices: geometry.attributes.position.array,
        originalVertices: [...geometry.attributes.position.array],
      });

      this.scene.add(wave);
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const time = Date.now() * 0.0002;

    this.waves.forEach(wave => {
      const vertices = wave.vertices;
      const originalVertices = wave.originalVertices;

      for (let i = 0; i < vertices.length; i += 3) {
        const x = originalVertices[i];
        const y = originalVertices[i + 1];

        const distance = Math.sqrt(x * x + y * y);
        const waveHeight = this.isHovered ? 4.0 : 2.0;
        const frequency = this.isHovered ? 0.6 : 0.3;

        vertices[i + 2] =
          Math.sin(distance * frequency - time) * waveHeight +
          Math.sin(distance * frequency * 0.3 + time * 0.7) * waveHeight * 0.7 +
          Math.sin(distance * frequency * 0.2 - time * 0.3) * waveHeight * 0.5;
      }

      wave.mesh.geometry.attributes.position.needsUpdate = true;
      wave.mesh.rotation.z = time * 0.08;
    });

    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    window.addEventListener('resize', () => {
      // Update dimensions based on container
      this.updateDimensions();
      
      this.camera.aspect = this.canvasWidth / this.canvasHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.canvasWidth, this.canvasHeight);
    });
  }

  setupEventListeners() {
    if (typeof gsap === 'undefined') {
      console.warn('GSAP not found, skipping advanced animations');
      return;
    }

    this.container.addEventListener('mouseenter', () => this.handleMouseEnter());
    this.container.addEventListener('mouseleave', () => this.handleMouseLeave());
    this.container.addEventListener('mousemove', e => this.handleMouseMove(e));
  }

  handleMouseEnter() {
    this.isHovered = true;
    if (typeof gsap !== 'undefined') {
      this.waves.forEach(wave => {
        gsap.to(wave.mesh.material, {
          opacity: 0.25,
          duration: 0.5,
        });
      });
    }
  }

  handleMouseLeave() {
    this.isHovered = false;
    if (typeof gsap !== 'undefined') {
      this.waves.forEach(wave => {
        gsap.to(wave.mesh.material, {
          opacity: 0.15,
          duration: 0.5,
        });
        gsap.to(wave.mesh.rotation, {
          x: Math.PI / 2,
          y: 0,
          duration: 0.8,
          ease: 'power2.out',
        });
      });
    }
  }

  handleMouseMove(event) {
    if (!this.isHovered || typeof gsap === 'undefined') return;

    const rect = this.container.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.waves.forEach(wave => {
      gsap.to(wave.mesh.rotation, {
        x: Math.PI / 2 + mouseY * 0.2,
        y: mouseX * 0.2,
        duration: 0.5,
        ease: 'power2.out',
      });
    });
  }
}

// Mobile navigation menu
class MobileMenu {
  constructor() {
    this.menuToggle = document.getElementById('mobile-menu-toggle');
    this.navLinks = document.getElementById('nav-links');
    this.isOpen = false;
    

    
    this.init();
  }

  init() {
    if (this.menuToggle && this.navLinks) {
      this.menuToggle.addEventListener('click', () => this.toggleMenu());
      
      // Handle dropdown clicks - works for both mobile and desktop
      this.setupDropdowns();
      
      // Close menu when clicking on a navigation link (except dropdown toggles)
      this.navLinks.querySelectorAll('a:not(.dropdown-toggle)').forEach(link => {
        link.addEventListener('click', () => {
          // Only close menu if we're on mobile (menu is visible)
          if (this.isOpen) {
            this.closeMenu();
          }
        });
      });
      
      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        if (this.isOpen && !this.menuToggle.contains(e.target) && !this.navLinks.contains(e.target)) {
          this.closeMenu();
        }
      });
      
      // Close menu on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.closeMenu();
        }
      });

      // Handle window resize to close mobile menu if switching to desktop
      window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && this.isOpen) {
          this.closeMenu();
        }
      });
    }
  }

  setupDropdowns() {
    const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
    dropdownToggles.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const dropdown = toggle.parentElement;
        const isActive = dropdown.classList.contains('active');
        
        // Check if we're in mobile mode
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
          // Mobile behavior: toggle dropdown

          
          // Close all other dropdowns
          document.querySelectorAll('.nav-dropdown').forEach(dd => {
            if (dd !== dropdown) {
              dd.classList.remove('active');
            }
          });
          
          // Toggle current dropdown
          if (isActive) {
            dropdown.classList.remove('active');
          } else {
            dropdown.classList.add('active');
          }
        } else {
          // Desktop behavior: let CSS hover handle it
          return;
        }
      });
    });
  }

  toggleMenu() {
    if (this.isOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    this.isOpen = true;
    this.menuToggle.classList.add('active');
    this.navLinks.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling when menu is open
  }

  closeMenu() {
    this.isOpen = false;
    this.menuToggle.classList.remove('active');
    this.navLinks.classList.remove('active');
    
    // Close all dropdowns when menu closes
    document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
      dropdown.classList.remove('active');
    });
    
    document.body.style.overflow = ''; // Restore scrolling
  }
}

// Smooth scrolling for navigation
class SmoothScroll {
  constructor() {
    this.init();
  }

  init() {
    // Handle smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SoundWaveAnimation();
  new SmoothScroll();
  new MobileMenu();
  
  // Initialize RSS parser if on pages that need it
  if (document.getElementById('episodes-grid') || document.getElementById('all-episodes-grid')) {
    // RSS parser will be loaded separately

  }
}); 