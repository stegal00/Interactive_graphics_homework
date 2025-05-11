var raytraceFS = `
struct Ray {
	vec3 pos;
	vec3 dir;
};

struct Material {
	vec3  k_d;	// diffuse coefficient
	vec3  k_s;	// specular coefficient
	float n;	// specular exponent
};

struct Sphere {
	vec3     center;
	float    radius;
	Material mtl;
};

struct Light {
	vec3 position;
	vec3 intensity;
};

struct HitInfo {
	float    t;
	vec3     position;
	vec3     normal;
	Material mtl;
};

uniform Sphere spheres[ NUM_SPHERES ];
uniform Light  lights [ NUM_LIGHTS  ];
uniform samplerCube envMap;
uniform int bounceLimit;

bool IntersectRay( inout HitInfo hit, Ray ray );

bool IntersectShadowRay(Ray ray){
	
	bool foundHit = false;
	for ( int i=0; i<NUM_SPHERES; ++i ) {
		Sphere sphere = spheres[i];

		float discriminant = pow(dot(ray.dir, (ray.pos - sphere.center)), 2.0) - 
			(dot(ray.dir, ray.dir) * (dot((ray.pos - sphere.center), (ray.pos - sphere.center)) - pow(sphere.radius, 2.0))); 

		if(discriminant >= 0.0){
			foundHit = true; 
		}

		float tVal = ((-1.0 * dot(ray.dir, (ray.pos-sphere.center))) - sqrt(discriminant)) / (dot(ray.dir, ray.dir));
		if(tVal < 0.0){
			foundHit = false;
		}
		
		if(foundHit){
			return foundHit;
		}	
	}
	return foundHit;
}

// Shades the given point and returns the computed color.
vec3 Shade( Material mtl, vec3 position, vec3 normal, vec3 view )
{
	float eplison = 0.003;
	vec3 ambientComponent = mtl.k_d * 0.05;
	vec3 color;
	normal = normalize(normal);

	for ( int i=0; i<NUM_LIGHTS; ++i ) {
		
		Ray surfaceToLightRay; 
		surfaceToLightRay.dir = normalize(lights[i].position - position);
		surfaceToLightRay.pos = position + (surfaceToLightRay.dir) * eplison;  

		if( IntersectShadowRay(surfaceToLightRay) ){
			// color += vec3(1.0,0.0,0.0);	
			color += ambientComponent;
		}else{
			vec3 lightDir = normalize((lights[i].position - position));
			float cosTheta = dot(normal, lightDir);
			vec3 diffuseComponent = mtl.k_d * lights[i].intensity * max(0.0, cosTheta); 
			
			vec3 halfAngle = normalize(view + lightDir);
			vec3 specularComponent = mtl.k_s * lights[i].intensity * pow(max(0.0, dot(normal, halfAngle)),mtl.n); 
			
			color += ambientComponent + diffuseComponent + specularComponent;
		}
	}
	return color;
}

// Intersects the given ray with all spheres in the scene
// and updates the given HitInfo using the information of the sphere
// that first intersects with the ray.
// Returns true if an intersection is found.
bool IntersectRay( inout HitInfo hit, Ray ray )
{
	hit.t = 1e30;
	bool foundHit = false;

	for ( int i=0; i<NUM_SPHERES; ++i ) {
		Sphere sphere = spheres[i];

		float discriminant = pow(dot(ray.dir, (ray.pos - sphere.center)), 2.0) - 
			(dot(ray.dir, ray.dir) * (dot((ray.pos - sphere.center), (ray.pos - sphere.center)) - pow(sphere.radius, 2.0))); 

		if(discriminant >= 0.0){ // hit found

			float t0 = (-(dot(ray.dir, (ray.pos-sphere.center))) - sqrt(discriminant)) / (dot(ray.dir, ray.dir));

			if( t0 > 0.0 && t0 <= hit.t){
				foundHit = true;

				hit.t = t0; 
				hit.position = ray.pos + (ray.dir * t0) ; 
				hit.normal = normalize((hit.position - sphere.center)/sphere.radius); 
	
				hit.mtl = sphere.mtl;
			}	
	
		}
		
	}
	return foundHit;
}

// Given a ray, returns the shaded color where the ray intersects a sphere.
// If the ray does not hit a sphere, returns the environment color.
vec4 RayTracer( Ray ray )
{
	HitInfo hit;
	if ( IntersectRay( hit, ray ) ) {
		vec3 view = normalize( -ray.dir );
		vec3 clr = Shade( hit.mtl, hit.position, hit.normal, view );
		
		vec3 k_s = hit.mtl.k_s;
		for ( int bounce=0; bounce<MAX_BOUNCES; ++bounce ) {
			if ( bounce >= bounceLimit ) break;
			if ( hit.mtl.k_s.r + hit.mtl.k_s.g + hit.mtl.k_s.b <= 0.0 ) break;
			
			Ray r;	
			HitInfo h;	
			
			r.dir = normalize(ray.dir) - 2.0 * (dot(normalize(ray.dir), hit.normal))* hit.normal;
			r.pos = hit.position + (r.dir) * 0.0001;

			
			if ( IntersectRay( h, r ) ) {
				clr += Shade(h.mtl, h.position, h.normal, view);
				
				hit = h;
				ray = r;					
			} else {
				clr += k_s * textureCube( envMap, r.dir.xzy ).rgb;
				break;	
			}
		}
		
		return vec4( clr, 1 );	
	} else {
		return vec4( textureCube( envMap, ray.dir.xzy ).rgb, 0 );	
	}
}
`;