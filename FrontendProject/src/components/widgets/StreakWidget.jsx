import { useRef, useEffect } from 'react';

// ── GLSL shaders — do not modify ──────────────────────────────────────────────
const VERT = `attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;
const FRAG = `
  precision mediump float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_balance;
  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
    float angle = u_time * 0.4;
    float s = sin(angle); float c = cos(angle);
    uv = mat2(c, -s, s, c) * uv;
    float balance = u_balance;
    float white_r = 0.5 + balance * 0.5;
    float black_r = 0.5 - balance * 0.5;
    vec2 white_c = vec2(0.0, 1.0 - white_r);
    vec2 black_c = vec2(0.0, -1.0 + black_r);
    float px = 2.0 / min(u_resolution.x, u_resolution.y);
    float col = smoothstep(-px, px, uv.x);
    float d_w = length(uv - white_c) - white_r;
    col = mix(1.0, col, smoothstep(-px, px, d_w));
    float d_b = length(uv - black_c) - black_r;
    col = mix(0.0, col, smoothstep(-px, px, d_b));
    float d_outer = length(uv) - 0.88;
    float alpha = 1.0 - smoothstep(-px, px, d_outer);
    gl_FragColor = vec4(mix(vec3(0.05), vec3(0.95), col), alpha);
  }
`;

function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  return shader;
}

// Props:
//   yang — SUM of currentStreak for isNegative === false (Good habits)
//   yin  — SUM of currentStreak for isNegative === true  (Avoid habits maintained)
export default function StreakWidget({ yin = 0, yang = 0 }) {
  const canvasRef    = useRef(null);
  // targetRef holds the desired balance in [-1, 1] so the render loop can
  // read it on every frame without triggering a WebGL program rebuild.
  const targetRef    = useRef(0);

  // Recompute target whenever props change — no WebGL restart needed.
  useEffect(() => {
    const total = Number(yang) + Number(yin);
    // Maps yang/(yang+yin) onto [-1, 1] so the shader's symmetric formulas
    // produce a visually balanced symbol when yang === yin.
    targetRef.current = total > 0 ? (Number(yang) - Number(yin)) / total : 0;
  }, [yang, yin]);

  // Build the WebGL program exactly once; render loop runs until unmount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER,   VERT));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),
      gl.STATIC_DRAW,
    );
    const posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uRes  = gl.getUniformLocation(prog, 'u_resolution');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uBal  = gl.getUniformLocation(prog, 'u_balance');

    const t0 = performance.now();
    let current = targetRef.current;
    let raf;

    const render = (now) => {
      const dpr = window.devicePixelRatio || 1;
      const w   = Math.floor(canvas.clientWidth  * dpr);
      const h   = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      }

      // Smooth lerp toward the latest target each frame
      current += (targetRef.current - current) * 0.02;

      gl.uniform2f(uRes,  gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.uniform1f(uBal,  current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []); // intentionally empty — program built once

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '4px 10px',
        height: '42px',
        border: '1px solid rgba(255,255,255,0.1)',
        userSelect: 'none',
      }}
    >
      {/* Yang — Good streaks */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px' }}>
        <span style={{ fontSize: '15px', fontWeight: '700', fontFamily: '-apple-system,system-ui,sans-serif', color: '#fff', lineHeight: 1 }}>
          {yang}
        </span>
        <span style={{ fontSize: '8px', fontWeight: '800', textTransform: 'uppercase', marginTop: '2px', letterSpacing: '0.5px', color: '#fff' }}>
          Good
        </span>
      </div>

      {/* WebGL Taijitu */}
      <div
        style={{ position: 'relative', width: 32, height: 32, margin: '0 8px',
                 borderRadius: '50%', overflow: 'hidden',
                 border: '1px solid rgba(255,255,255,0.2)',
                 boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      {/* Yin — Avoid streaks maintained */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px' }}>
        <span style={{ fontSize: '15px', fontWeight: '700', fontFamily: '-apple-system,system-ui,sans-serif', color: '#fff', lineHeight: 1 }}>
          {yin}
        </span>
        <span style={{ fontSize: '8px', fontWeight: '800', textTransform: 'uppercase', marginTop: '2px', letterSpacing: '0.5px', color: '#fff' }}>
          Avoid
        </span>
      </div>
    </div>
  );
}
