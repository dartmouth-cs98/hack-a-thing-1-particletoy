declare var WebGLDebugUtils: any;

function throwOnGLError(err, funcName, args) {
    throw WebGLDebugUtils.glEnumToString(err) + " was caused by call to: " + funcName;
  };

// Set up WebGL
var canvas = <HTMLCanvasElement>document.getElementById("mainCanvas");
var gl = canvas.getContext("webgl2");
if (!gl) {
    console.log("Error: could not get webgl2");
} else {
    gl = WebGLDebugUtils.makeDebugContext(gl, throwOnGLError);
    main(gl);
}

// Adapted from https://webgl2fundamentals.org/webgl/lessons/webgl-fundamentals.html
function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    } else {
        var e = "Shader build error: " + gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(e);
    }
}

function main(gl: WebGL2RenderingContext) {
    var vs_source = `#version 300 es

    // an attribute is an input (in) to a vertex shader.
    // It will receive data from a buffer
    in vec2 a_position;
    in vec2 a_velocity;
    out vec2 v_position;
    out vec2 v_velocity;

    // all shaders have a main function
    void main() {
      gl_Position = vec4(a_position, 0, 1);
      // Pass through to fragment shader
      v_velocity = a_velocity;

      // Update pos/vel for transform feedback
      v_position = a_position;
      v_position += a_velocity;
    }`;

    var fs_source = `#version 300 es

    // fragment shaders don't have a default precision so we need
    // to pick one. mediump is a good default. It means "medium precision"
    precision mediump float;

    in vec2 v_velocity;
    // we need to declare an output for the fragment shader
    out vec4 outColor;

    void main() {
        // TODO: Brighten with velocity
        //outColor = vec4(v_velocity.x, v_velocity.y, 1, 1);
        outColor = vec4(1, 1, 1, 1);
    }`;

    var vs = createShader(gl, gl.VERTEX_SHADER, vs_source);
    var fs = createShader(gl, gl.FRAGMENT_SHADER, fs_source);
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.transformFeedbackVaryings(program, ['v_position', 'v_velocity'], gl.SEPARATE_ATTRIBS);
    gl.linkProgram(program);

    var positionBuffer = gl.createBuffer();
    var velocityBuffer = gl.createBuffer();
    var tfPositionBuffer = gl.createBuffer();
    var tfVelocityBuffer = gl.createBuffer();

    var positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    var velocityAttributeLocation = gl.getAttribLocation(program, "a_velocity");

    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Setup buffers
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(
        positionAttributeLocation, size, type, normalize, stride, offset);

    gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffer);
    gl.enableVertexAttribArray(velocityAttributeLocation);
    gl.vertexAttribPointer(
        velocityAttributeLocation, size, type, normalize, stride, offset);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear the canvas
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Tell it to use our program (pair of shaders)
    gl.useProgram(program);

    // Bind the attribute/buffer set we want.
    gl.bindVertexArray(vao);
    var transformFeedback = gl.createTransformFeedback();


    var count = 10000;
    var positions = [];
    var vels = [];
    for(var i = 0; i < count; i++) {
        positions.push(2 * Math.random() - 1); // x
        positions.push(2 * Math.random() - 1); // y
        vels.push(0.01);
        vels.push(0.01);
    }
    // Update buffers and draw
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vels), gl.STATIC_DRAW);

    // Fill transform buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, tfPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, tfVelocityBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vels), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    function drawScene() {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, tfPositionBuffer);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, tfVelocityBuffer);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, count);
        gl.endTransformFeedback();
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);

        gl.bindBuffer(gl.COPY_WRITE_BUFFER, positionBuffer);
        gl.bindBuffer(gl.COPY_READ_BUFFER, tfPositionBuffer);
        gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, 8 * count);
        gl.bindBuffer(gl.COPY_WRITE_BUFFER, velocityBuffer);
        gl.bindBuffer(gl.COPY_READ_BUFFER, tfVelocityBuffer);
        gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, 8 * count);
        gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
        gl.bindBuffer(gl.COPY_READ_BUFFER, null);

        // // gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        // var arrBuffer = new Float32Array(2000);
        // gl.bindBuffer(gl.ARRAY_BUFFER, tfPositionBuffer);
        // gl.getBufferSubData(gl.ARRAY_BUFFER, 0, arrBuffer, 0, 2000);
        // console.log(arrBuffer);
        requestAnimationFrame(drawScene);
    }
    drawScene();
}
