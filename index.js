function throwOnGLError(err, funcName, args) {
    throw WebGLDebugUtils.glEnumToString(err) + " was caused by call to: " + funcName;
}
;
// Set up WebGL
var canvas = document.getElementById("mainCanvas");
var gl = canvas.getContext("webgl2");
if (!gl) {
    console.log("Error: could not get webgl2");
    canvas.hidden = true;
}
else {
    document.getElementById("glerror").hidden = true;
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
    }
    else {
        var e = "Shader build error: " + gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(e);
    }
}
function main(gl) {
    var vs_source = "#version 300 es\n\n    uniform vec2 mouse;\n    uniform bool accel;\n    uniform float accelAmount;\n\n    in vec2 a_position;\n    in vec2 a_velocity;\n    out vec2 v_position;\n    out vec2 v_velocity;\n\n    // from https://thebookofshaders.com/10/\n    float random (vec2 st) {\n        return fract(sin(dot(st.xy,\n                             vec2(12.9898,78.233)))*\n            43758.5453123);\n    }\n\n    void main() {\n      gl_Position = vec4(a_position, 0, 1);\n      // Pass through to fragment shader\n      v_velocity = a_velocity;\n\n      if(accel) {\n          vec2 del = normalize(mouse - a_position);\n          v_velocity += del * accelAmount;\n      }\n\n      // Friction\n      v_velocity *= (1.0 - 0.01 * (1.0 + random(v_position)));\n\n      // Update pos/vel for transform feedback\n      v_position = a_position;\n      v_position += v_velocity;\n      if(v_position.x > 1.0) {\n          v_position.x = 2.0 - v_position.x;\n          v_velocity.x = -v_velocity.x;\n      }\n      if(v_position.y > 1.0) {\n        v_position.y = 2.0 - v_position.y;\n        v_velocity.y = -v_velocity.y;\n      }\n      if(v_position.x < -1.0) {\n        v_position.x = -2.0 - v_position.x;\n        v_velocity.x = -v_velocity.x;\n      }\n      if(v_position.y < -1.0) {\n        v_position.y = -2.0 - v_position.y;\n        v_velocity.y = -v_velocity.y;\n      }\n\n    }";
    var fs_source = "#version 300 es\n\n    // fragment shaders don't have a default precision so we need\n    // to pick one. mediump is a good default. It means \"medium precision\"\n    precision mediump float;\n\n    in vec2 v_velocity;\n    // we need to declare an output for the fragment shader\n    out vec4 outColor;\n\n    vec3 hsv2rgb(vec3 c) {\n        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);\n        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);\n        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);\n    }\n\n    void main() {\n        // Technically HSV is supposed to be between 0 and 1 but I found that\n        // letting the value go higher causes it to wrap-around and look cool\n        float vel = clamp(length(v_velocity) * 20.0, 0.0, 2.0);\n        outColor = vec4(\n            hsv2rgb(vec3(\n                0.6 - vel * 0.6,  // hue\n                1.0,               // sat\n                max(0.2 + vel, 0.8) // vibrance\n            )),\n        1.0);\n    }";
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
    var accelLocation = gl.getUniformLocation(program, "accel");
    var accelAmountLocation = gl.getUniformLocation(program, "accelAmount");
    var mouseLocation = gl.getUniformLocation(program, "mouse");
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    // Setup buffers
    var size = 2; // 2 components per iteration
    var type = gl.FLOAT; // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0; // start at the beginning of the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
    gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffer);
    gl.enableVertexAttribArray(velocityAttributeLocation);
    gl.vertexAttribPointer(velocityAttributeLocation, size, type, normalize, stride, offset);
    // Tell it to use our program (pair of shaders)
    gl.useProgram(program);
    // Bind the attribute/buffer set we want.
    gl.bindVertexArray(vao);
    var transformFeedback = gl.createTransformFeedback();
    var count = 10000;
    var initParticles = function () {
        var positions = [];
        var vels = [];
        for (var i = 0; i < count; i++) {
            positions.push(2 * Math.random() - 1); // x
            positions.push(2 * Math.random() - 1); // y
            vels.push(0.0);
            vels.push(0.0);
        }
        // Fill main buffers
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
    };
    // Set by input callback
    var accelAmount = 0.0;
    var mouse = [0.0, 0.0];
    var accel = false;
    // Callbacks
    canvas.oncontextmenu = function () { return false; };
    canvas.addEventListener("mousemove", function (e) {
        mouse[0] = (e.offsetX / canvas.clientWidth) * 2 - 1;
        mouse[1] = ((canvas.clientHeight - e.offsetY) / canvas.clientHeight) * 2 - 1;
    });
    canvas.addEventListener("mousedown", function (e) {
        accel = true;
        if (e.button == 2) {
            // Invert acceleration for right click
            accelAmount = -Math.abs(accelAmount);
        }
        else {
            accelAmount = Math.abs(accelAmount);
        }
    });
    canvas.addEventListener("mouseup", function () {
        accel = false;
    });
    var handleResize = function () {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    };
    window.addEventListener("resize", handleResize);
    var acval = document.getElementById("accelVal");
    var ac = document.getElementById("accel");
    ac.oninput = function (ev) {
        accelAmount = Number(this.value) * 0.0001;
        acval.textContent = accelAmount.toPrecision(3);
    };
    var pointsVal = document.getElementById("pointsVal");
    var points = document.getElementById("points");
    var newCount = 0;
    points.oninput = function (ev) {
        newCount = Math.round(500 * Math.exp(Number(this.value) / 12));
        pointsVal.textContent = "" + newCount;
    };
    points.onchange = function (ev) {
        // When user is done sliding, re-init particle buffers
        count = newCount;
        initParticles();
    };
    function drawScene() {
        gl.uniform1i(accelLocation, accel ? 1 : 0);
        gl.uniform1f(accelAmountLocation, accelAmount);
        gl.uniform2f(mouseLocation, mouse[0], mouse[1]);
        gl.clearColor(0.01, 0.01, 0.01, 1);
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
        requestAnimationFrame(drawScene);
    }
    // Set up points by manually calling the callbacks
    ac.oninput(null);
    points.oninput(null);
    points.onchange(null);
    handleResize();
    drawScene();
}
