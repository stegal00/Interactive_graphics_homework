// Funzioni helper per creare matrici di rotazione 
function M_RotX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        1, 0, 0, 0,
        0, c, s, 0,
        0,-s, c, 0,
        0, 0, 0, 1
    ];
}

function M_RotY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        c, 0,-s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1
    ];
}

// This function takes the projection matrix, the translation, and two rotation angles (in radians) as input arguments.
// The two rotations are applied around x and y axes.
// It returns the combined 4x4 transformation matrix as an array in column-major order.
// The given projection matrix is also a 4x4 matrix stored as an array in column-major order.
// You can use the MatrixMult function defined in project4.html to multiply two 4x4 matrices in the same format.
function GetModelViewProjection( projectionMatrix, translationX, translationY, translationZ, rotationX, rotationY )
{
    var rotX = M_RotX( rotationX );
    var rotY = M_RotY( rotationY );

    var trans = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        translationX, translationY, translationZ, 1
    ];

    var modelRotation = MatrixMult( rotY, rotX );
    var modelView = MatrixMult( trans, modelRotation );
    var mvp = MatrixMult( projectionMatrix, modelView );

    return mvp;
}

// Vertex Shader
const vsSource = `
    attribute vec4 aVertexPosition; 
    attribute vec2 aTexCoord;       

    uniform mat4 uMvpMatrix;      
    uniform bool uSwapYZ;         

    varying highp vec2 vTexCoord; 

    void main(void) {
      vec4 position = aVertexPosition;
      if (uSwapYZ) {
        position = vec4(position.x, position.z, position.y, position.w);
      }
      gl_Position = uMvpMatrix * position; 
      vTexCoord = aTexCoord;               
    }
  `;

// Fragment Shader
const fsSource = `
    varying highp vec2 vTexCoord; 

    uniform sampler2D uSampler;   
    uniform bool uShowTexture;    

    void main(void) {
      if (uShowTexture) {
        gl_FragColor = texture2D(uSampler, vTexCoord);
      } else {
        gl_FragColor = vec4(1.0, gl_FragCoord.z * gl_FragCoord.z, 0.0, 1.0);
      }
    }
  `;

// Funzione per caricare e compilare uno shader
function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('Errore durante la compilazione dello shader: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Funzione per inizializzare il programma shader
function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    return shaderProgram;
}


class MeshDrawer {
    // The constructor is a good place for taking care of the necessary initializations.
    constructor() {

        this.program = initShaderProgram(gl, vsSource, fsSource);
        gl.useProgram(this.program); 

        this.positionAttributeLocation = gl.getAttribLocation(this.program, 'aVertexPosition');
        this.texCoordAttributeLocation = gl.getAttribLocation(this.program, 'aTexCoord');
        this.mvpUniformLocation = gl.getUniformLocation(this.program, 'uMvpMatrix');
        this.swapYZUniformLocation = gl.getUniformLocation(this.program, 'uSwapYZ');
        this.samplerUniformLocation = gl.getUniformLocation(this.program, 'uSampler');
        this.showTextureUniformLocation = gl.getUniformLocation(this.program, 'uShowTexture');

        this.vertexBuffer = gl.createBuffer();
        this.texCoordBuffer = gl.createBuffer();

        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                      new Uint8Array([255, 255, 255, 255])); 
        gl.bindTexture(gl.TEXTURE_2D, null); 

        this.numVertices = 0; 
        this.isSwapYZ = false; 
        this.isTextureShown = false; 
        this.hasTexture = false;     
    }

    // This method is called every time the user opens an OBJ file.
	// The arguments of this function is an array of 3D vertex positions
	// and an array of 2D texture coordinates.
	// Every item in these arrays is a floating point value, representing one
	// coordinate of the vertex position or texture coordinate.
	// Every three consecutive elements in the vertPos array forms one vertex
	// position and every three consecutive vertex positions form a triangle.
	// Similarly, every two consecutive elements in the texCoords array
	// form the texture coordinate of a vertex.
	// Note that this method can be called multiple times.
    setMesh( vertPos, texCoords ) {
        this.numVertices = vertPos.length / 3; 
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null); 
    }

    // This method is called when the user changes the state of the
	// "Swap Y-Z Axes" checkbox. 
	// The argument is a boolean that indicates if the checkbox is checked.
    swapYZ( swap ) {
        this.isSwapYZ = swap;
    }

    // This method is called to draw the triangular mesh.
	// The argument is the transformation matrix, the same matrix returned
	// by the GetModelViewProjection function above.
    draw( trans ) {
        gl.useProgram(this.program);

        gl.uniformMatrix4fv(this.mvpUniformLocation, false, trans); 
        gl.uniform1i(this.swapYZUniformLocation, this.isSwapYZ ? 1 : 0); 
        gl.uniform1i(this.showTextureUniformLocation, this.isTextureShown ? 1 : 0); 

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		
        gl.vertexAttribPointer(
            this.positionAttributeLocation,
            3,         
            gl.FLOAT,  
            false,     
            0,         
            0          
        );
        
		gl.enableVertexAttribArray(this.positionAttributeLocation); 
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);

        gl.vertexAttribPointer(
            this.texCoordAttributeLocation,
            2,         
            gl.FLOAT,  
            false,     
            0,         
            0          
        );

        gl.enableVertexAttribArray(this.texCoordAttributeLocation); 

        if (this.hasTexture) {
            gl.activeTexture(gl.TEXTURE0); 
            gl.bindTexture(gl.TEXTURE_2D, this.texture); 
            gl.uniform1i(this.samplerUniformLocation, 0); 
        } 

        gl.drawArrays( gl.TRIANGLES, 0, this.numVertices );
    }

    // This method is called to set the texture of the mesh.
	// The argument is an HTML IMG element containing the texture data.
    setTexture( img ) {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); 
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); 
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); 
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); 
        gl.bindTexture(gl.TEXTURE_2D, null);

        this.hasTexture = true; 
    }

	// This method is called when the user changes the state of the
	// "Show Texture" checkbox. 
	// The argument is a boolean that indicates if the checkbox is checked.
    showTexture( show ) {
        this.isTextureShown = show;
    }
}