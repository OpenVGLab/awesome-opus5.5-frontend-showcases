// Stand-in for `three/webgpu`. The site renders with WebGLRenderer only; these classes exist so
// three-globe / three-render-objects can import them, and fail loudly if a WebGPU path is ever hit.
class WebGPUDisabled {
  constructor() {
    throw new Error('three/webgpu is not included in this build; use the WebGL renderer.');
  }
}

module.exports = {
  WebGPURenderer: WebGPUDisabled,
  StorageInstancedBufferAttribute: WebGPUDisabled,
};
