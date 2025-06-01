// --------- Vertex Shader Source --------
const vertexShaderSource = `
  attribute vec3 a_position;    
  attribute vec2 a_texcoord;    
  attribute vec3 a_normal;      

  uniform mat4 u_mvp;         
  uniform mat4 u_mv;          
  uniform mat3 u_normalMatrix; 
  uniform bool u_swapYZ;      

  varying vec2 v_texcoord;      
  varying vec3 v_normal_cam;    
  varying vec3 v_pos_cam;       

  void main() {
    vec3 pos = u_swapYZ ? a_position.xzy : a_position;
    vec3 norm = u_swapYZ ? a_normal.xzy : a_normal;

    v_pos_cam = (u_mv * vec4(pos, 1.0)).xyz;
    v_normal_cam = normalize(u_normalMatrix * norm);
    v_texcoord = a_texcoord;

    gl_Position = u_mvp * vec4(pos, 1.0);
  }
`;

// --------- Fragment Shader Source --------
const fragmentShaderSource = `
  precision mediump float; 

  uniform sampler2D u_sampler;     
  uniform bool u_showTexture;     
  uniform vec3 u_lightDir;        
  uniform float u_shininess;  

  varying vec2 v_texcoord;      
  varying vec3 v_normal_cam;    
  varying vec3 v_pos_cam;       

  void main() {
    vec3 K_d_default = vec3(1.0, 1.0, 1.0); 
    vec3 K_s = vec3(1.0, 1.0, 1.0);         
    vec3 lightColor = vec3(1.0, 1.0, 1.0); 
    vec3 K_d = K_d_default;

    if (u_showTexture) {
      K_d = texture2D(u_sampler, v_texcoord).rgb; 
    }

    vec3 N = normalize(v_normal_cam);           
    vec3 L = normalize(u_lightDir);             
    vec3 V = normalize(-v_pos_cam);             
    vec3 H = normalize(L + V);    

    float NdotL = max(dot(N, L), 0.0);
    vec3 diffuse = K_d * lightColor * NdotL;
    float NdotH = max(dot(N, H), 0.0);
    float specFactor = pow(NdotH, u_shininess);
    vec3 specular = K_s * lightColor * specFactor;
    vec3 finalColor = diffuse + specular; 
    finalColor = clamp(finalColor, 0.0, 1.0);
    gl_FragColor = vec4(finalColor, 1.0); 
  }
`;

// This function takes the translation and two rotation angles (in radians) as input arguments.
// The two rotations are applied around x and y axes.
// It returns the combined 4x4 transformation matrix as an array in column-major order.
// You can use the MatrixMult function defined in project5.html to multiply two 4x4 matrices in the same format.
function GetModelViewMatrix( translationX, translationY, translationZ, rotationX, rotationY )
{
    var trans = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        translationX, translationY, translationZ, 1
    ];

    var cosX = Math.cos(rotationX);
    var sinX = Math.sin(rotationX);
    var rotX = [
        1, 0,    0,   0,
        0, cosX, sinX, 0,
        0, -sinX,cosX, 0,
        0, 0,    0,   1
    ];

    var cosY = Math.cos(rotationY);
    var sinY = Math.sin(rotationY);
    var rotY = [
        cosY, 0, -sinY, 0,
        0,    1, 0,    0,
        sinY, 0, cosY, 0,
        0,    0, 0,    1
    ];

    var rot = MatrixMult( rotY, rotX );
    var mv = MatrixMult( trans, rot );
    return mv;
}

class MeshDrawer
{
	// The constructor is a good place for taking care of the necessary initializations.
	constructor()
    {
        this.vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(this.vs, vertexShaderSource);
        gl.compileShader(this.vs);
        if (!gl.getShaderParameter(this.vs, gl.COMPILE_STATUS)) {
            console.error("Vertex shader compilation error:", gl.getShaderInfoLog(this.vs));
            return;
        }

        this.fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(this.fs, fragmentShaderSource);
        gl.compileShader(this.fs);
        if (!gl.getShaderParameter(this.fs, gl.COMPILE_STATUS)) {
            console.error("Fragment shader compilation error:", gl.getShaderInfoLog(this.fs));
            return;
        }

        this.prog = gl.createProgram();
        gl.attachShader(this.prog, this.vs);
        gl.attachShader(this.prog, this.fs);
        gl.linkProgram(this.prog);
        if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
            console.error("Shader program linking error:", gl.getProgramInfoLog(this.prog));
            return;
        }

        this.posAttribLoc = gl.getAttribLocation(this.prog, 'a_position');
        this.texCoordAttribLoc = gl.getAttribLocation(this.prog, 'a_texcoord');
        this.normalAttribLoc = gl.getAttribLocation(this.prog, 'a_normal'); 
        this.mvpUniformLoc = gl.getUniformLocation(this.prog, 'u_mvp');
        this.mvUniformLoc = gl.getUniformLocation(this.prog, 'u_mv');             
        this.normalMatUniformLoc = gl.getUniformLocation(this.prog, 'u_normalMatrix'); 
        this.samplerUniformLoc = gl.getUniformLocation(this.prog, 'u_sampler');
        this.showTexUniformLoc = gl.getUniformLocation(this.prog, 'u_showTexture');
        this.swapYZUniformLoc = gl.getUniformLocation(this.prog, 'u_swapYZ');
        this.lightDirUniformLoc = gl.getUniformLocation(this.prog, 'u_lightDir');    
        this.shininessUniformLoc = gl.getUniformLocation(this.prog, 'u_shininess'); 
        this.vertexBuffer = gl.createBuffer();
        this.texCoordBuffer = gl.createBuffer();
        this.normalBuffer = gl.createBuffer(); 
        this.texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255])); // Blue pixel
        gl.bindTexture(gl.TEXTURE_2D, null); 

        this.numVertices = 0;
        this.showTextureState = true; 
        this.swapYZState = false;     
        this.lightDir = [0.0, 0.0, 1.0]; 
        this.shininess = 20.0;          
    }
	
	// This method is called every time the user opens an OBJ file.
	// The arguments of this function is an array of 3D vertex positions,
	// an array of 2D texture coordinates, and an array of vertex normals.
	// Every item in these arrays is a floating point value, representing one
	// coordinate of the vertex position or texture coordinate.
	// Every three consecutive elements in the vertPos array forms one vertex
	// position and every three consecutive vertex positions form a triangle.
	// Similarly, every two consecutive elements in the texCoords array
	// form the texture coordinate of a vertex and every three consecutive 
	// elements in the normals array form a vertex normal.
	// Note that this method can be called multiple times.
	setMesh( vertPos, texCoords, normals )
    {
        this.numVertices = vertPos.length / 3;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
	
	// This method is called when the user changes the state of the
	// "Swap Y-Z Axes" checkbox. 
	// The argument is a boolean that indicates if the checkbox is checked.
	swapYZ( swap )
    {
        this.swapYZState = swap;
    }
	
	// This method is called to draw the triangular mesh.
	// The arguments are the model-view-projection transformation matrixMVP,
	// the model-view transformation matrixMV, the same matrix returned
	// by the GetModelViewProjection function above, and the normal
	// transformation matrix, which is the inverse-transpose of matrixMV.
	draw( matrixMVP, matrixMV, matrixNormal )
    {
        gl.useProgram(this.prog); 

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(this.posAttribLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.posAttribLoc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.texCoordAttribLoc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.texCoordAttribLoc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(this.normalAttribLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.normalAttribLoc);

        gl.uniformMatrix4fv(this.mvpUniformLoc, false, matrixMVP);
        gl.uniformMatrix4fv(this.mvUniformLoc, false, matrixMV);
        gl.uniformMatrix3fv(this.normalMatUniformLoc, false, matrixNormal); 

        gl.activeTexture(gl.TEXTURE0); 
        gl.bindTexture(gl.TEXTURE_2D, this.texture); 
        gl.uniform1i(this.samplerUniformLoc, 0); 
        gl.uniform1i(this.showTexUniformLoc, this.showTextureState ? 1 : 0); 
        gl.uniform1i(this.swapYZUniformLoc, this.swapYZState ? 1 : 0);
        gl.uniform3fv(this.lightDirUniformLoc, this.lightDir); 
        gl.uniform1f(this.shininessUniformLoc, this.shininess); 

        if (this.numVertices > 0) {
            gl.drawArrays( gl.TRIANGLES, 0, this.numVertices );
        }

        gl.disableVertexAttribArray(this.posAttribLoc);
        gl.disableVertexAttribArray(this.texCoordAttribLoc);
        gl.disableVertexAttribArray(this.normalAttribLoc);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
	
	// This method is called to set the texture of the mesh.
	// The argument is an HTML IMG element containing the texture data.
	setTexture( img )
    {
        gl.bindTexture(gl.TEXTURE_2D, this.texture); 

        gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.generateMipmap(gl.TEXTURE_2D); 
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

        gl.bindTexture(gl.TEXTURE_2D, null); 
    }
	
	// This method is called when the user changes the state of the
	// "Show Texture" checkbox. 
	// The argument is a boolean that indicates if the checkbox is checked.
	showTexture( show )
    {
        this.showTextureState = show;
    }
	
	// This method is called to set the incoming light direction
	setLightDir( x, y, z )
    {
        this.lightDir = [x, y, z];
    }
	
	// This method is called to set the shininess of the material
	setShininess( shininess )
    {
        this.shininess = Math.max(shininess, 0.0); 
    }
} 

// This function is called for every step of the simulation.
// Its job is to advance the simulation for the given time step duration dt.
// It updates the given positions and velocities.
function SimTimeStep( dt, positions, velocities, springs, stiffness, damping, particleMass, gravity, restitution )
{
    var numParticles = positions.length;
    var forces = Array(numParticles); 

    for (var i = 0; i < numParticles; i++) {
        forces[i] = new Vec3(); 
        forces[i].init(0, 0, 0); 
    }

    for (var i = 0; i < numParticles; i++) {
        var gravForce = gravity.mul(particleMass);
        forces[i].inc(gravForce); 
    }

    for (var i = 0; i < springs.length; i++) {
        var spring = springs[i];
        var p0_index = spring.p0;
        var p1_index = spring.p1;

        var pos0 = positions[p0_index];
        var pos1 = positions[p1_index];

        var deltaPos = pos1.sub(pos0); 
        var currentLength = deltaPos.len();
        
        if (currentLength > 1e-9) { 
            var displacement = currentLength - spring.rest;
            var springForceMagnitude = stiffness * displacement;
            
            var springDirection = deltaPos.unit(); 
            
            var forceOnP0 = springDirection.mul(springForceMagnitude);
            var forceOnP1 = springDirection.mul(-springForceMagnitude); 

            forces[p0_index].inc(forceOnP0);
            forces[p1_index].inc(forceOnP1); 
            
            var vel0 = velocities[p0_index];
            var vel1 = velocities[p1_index];
            var relativeVel = vel1.sub(vel0);
            
            var relVelAlongSpring = relativeVel.dot(springDirection);
            
            var dampingForceMagnitude = damping * relVelAlongSpring;
            var dampingForceOnP0 = springDirection.mul(dampingForceMagnitude);
            var dampingForceOnP1 = springDirection.mul(-dampingForceMagnitude);
            
            forces[p0_index].inc(dampingForceOnP0);
            forces[p1_index].inc(dampingForceOnP1);
        }
    }
    
    for (var i = 0; i < numParticles; i++) {
        var globalDampingForce = velocities[i].mul(-damping * 0.1); 
        forces[i].inc(globalDampingForce);
    }
    
    for (var i = 0; i < numParticles; i++) {
        var acceleration = forces[i].div(particleMass); 

        velocities[i].inc(acceleration.mul(dt)); 

        positions[i].inc(velocities[i].mul(dt));
    }
    
    var BOX_MIN = -1.0;
    var BOX_MAX =  1.0;

    for (var i = 0; i < numParticles; i++) {
        var pos = positions[i]; 
        var vel = velocities[i]; 

        if (pos.x < BOX_MIN) {
            pos.x = BOX_MIN;
            if (vel.x < 0) { 
                vel.x *= -restitution;
            }
        } else if (pos.x > BOX_MAX) {
            pos.x = BOX_MAX;
            if (vel.x > 0) { 
                vel.x *= -restitution;
            }
        }

        if (pos.y < BOX_MIN) {
            pos.y = BOX_MIN;
            if (vel.y < 0) {
                vel.y *= -restitution;
            }
        } else if (pos.y > BOX_MAX) {
            pos.y = BOX_MAX;
            if (vel.y > 0) {
                vel.y *= -restitution;
            }
        }

        if (pos.z < BOX_MIN) {
            pos.z = BOX_MIN;
            if (vel.z < 0) {
                vel.z *= -restitution;
            }
        } else if (pos.z > BOX_MAX) {
            pos.z = BOX_MAX;
            if (vel.z > 0) {
                vel.z *= -restitution;
            }
        }
    }
}

