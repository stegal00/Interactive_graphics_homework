// Returns a 3x3 transformation matrix as an array of 9 values in column-major order.
// The transformation first applies scale, then rotation, and finally translation.
// The given rotation value is in degrees.
function GetTransform( positionX, positionY, rotation, scale )
{
	let rad = rotation * Math.PI / 180; 
    let cosR = Math.cos(rad);
    let sinR = Math.sin(rad);
    
    return [
        scale * cosR, scale * sinR, 0,  
        -scale * sinR, scale * cosR, 0, 
        positionX, positionY, 1         
    ];
}

// Returns a 3x3 transformation matrix as an array of 9 values in column-major order.
// The arguments are transformation matrices in the same format.
// The returned transformation first applies trans1 and then trans2.
function ApplyTransform( trans1, trans2 )
{
	let result = new Array(9).fill(0); 
    
    for (let col = 0; col < 3; col++) {  
        for (let row = 0; row < 3; row++) {  
            let sum = 0;
            for (let k = 0; k < 3; k++) {  
                sum += trans1[row + k * 3] * trans2[k + col * 3];
            }
            result[row + col * 3] = sum; 
        }
    }
    return result;
}
