/*global math*/

self.importScripts('../libs/math.js');

let polygons = [];
// what is the index of the next polygon to be passed back to the 
// main thread
let polyUpdateIndex = 0;
let domain = {};
let distFunc = null;

onmessage = function(e){
	let [requestType, ...args] = e.data;
	if(requestType === 'GRAPH'){
		graphParametricFunction2(...args, function(){
			postMessage(['FINISHED', getTotalPolyData(), polygons.length]);
		});
	}
}

function updateMainThread(){
	postMessage(['POLYGON_UPDATE', getPartialPolyData(), polygons.length]);
}

function getTotalPolyData(){
	// put the data in polygons into an array
	let polyData = [];
	for(let poly of polygons){
		polyDataPt(polyData, poly);
	}
	
	return polyData;
}

// used when updating the main thread. It only sends the polygons 
// that haven't been sent before
function getPartialPolyData(){
	let polyData = [];
	for(let k = polyUpdateIndex; k < polygons.length; k++){
		polyDataPt(polyData, polygons[k]);
	}
	polyUpdateIndex = polygons.length;
	
	return polyData;
}

function polyDataPt(polyData, poly){
	let c = 0;
	for(let p of poly.pts){
		polyData.push(p.x);
		polyData.push(p.y);
		polyData.push(p.z);
		
		// compute normal to point
		// (this is simly the cross product of p.deriv1.du and p.deriv1.dv)
		let normal = cross(p.deriv1.du, p.deriv1.dv);
		normal = scalar(1/magnitude(normal), normal);
		
		polyData.push(normal.x);
		polyData.push(normal.y);
		polyData.push(normal.z);
		
		let arr = [1.0, 0.0, 0.0];
		// barimetric data
		if(c === 1){
			arr = [0.0, 1.0, 0.0];
		}else if(c === 2){
			arr = [0.0, 0.0, 1.0];
		}
		
		for(let el of arr){
			polyData.push(el);
		}
		
		c++;
	}
}

function graphParametricFunction2(xFunc, yFunc, zFunc, d, onFinish){
	
	// update every 30 ms or so (we'll see how much that slows things down)
	let lastUpdateTime = Date.now();
	let updateDelta = 100;
	
	domain = d;
	for(var k = 0; k < 2; k++){
        xFunc = xFunc.replace(/\(y\)/g,'('+yFunc+')');
        xFunc = xFunc.replace(/\(z\)/g,'('+zFunc+')');
        
        yFunc = yFunc.replace(/\(x\)/g,'('+xFunc+')');
        yFunc = yFunc.replace(/\(z\)/g,'('+zFunc+')');
        
        zFunc = zFunc.replace(/\(x\)/g,'('+xFunc+')');
        zFunc = zFunc.replace(/\(y\)/g,'('+yFunc+')');
    }
    
    xFunc = math.compile('x='+xFunc);
    yFunc = math.compile('y='+yFunc);
    zFunc = math.compile('z='+zFunc);
	
	
    //for non-real points, how far to go
    var defaultDeltaU = (domain.u.max - domain.u.min) / domain.density, 
        defaultDeltaV = (domain.v.max - domain.v.min) / domain.density;
    
    //sometimes I'm really thankful I stretched the function instead of the domain...
    var defaultXYZLength = (domain.x.max - domain.x.min) / domain.density;
    
    polygons = [];
	polyUpdateIndex = 0;
    
    // center of domain, the seed point
    // note that this is NOT always foolproff ==> z = rho, rho in [-10, 10]
    const uMiddle = (domain.u.max + domain.u.min) / 2,
        vMiddle = (domain.v.max + domain.v.min) / 2;
    
    let initPoint = plotPlus(xFunc, yFunc, zFunc, uMiddle, vMiddle);
    //we have (x(u,v), y(u,v), z(u,v)) ≈ u du + v dv, so a linear transformation (a plane)
    //in order for a parameterization (x(s,t), y(s,t), z(s,t)) such that a change in s and t corresponds to 
    //an equal change in x,y and z, we need s = u du, t = v dv, or (u(s,t), v(s,t)) = (s / |du|, t / |dv|)
    let vec = dir(initPoint, defaultXYZLength, 0);
	
    let initPoint2 = plotPlus(xFunc, yFunc, zFunc, uMiddle + vec.u, vMiddle + vec.v);
    vec = dir(initPoint, defaultXYZLength*.5, defaultXYZLength*Math.sqrt(3)/2)
    let initPoint3 = plotPlus(xFunc, yFunc, zFunc, uMiddle + vec.u, vMiddle + vec.v)
    
    //the space that needs to be transversed goes counter-clockwise from beginning to end
    initPoint.beginning = initPoint3;
    initPoint.end = initPoint2;
    
    initPoint2.beginning = initPoint;
    initPoint2.end = initPoint3;
    
    initPoint3.beginning = initPoint2;
    initPoint3.end = initPoint;
    
    connectLoop(initPoint, initPoint2, initPoint3);
    
    polygons.push({
        pts:[initPoint, initPoint2, initPoint3]
    });
    
    let pointFront = [initPoint, initPoint2, initPoint3];
    distFunc = p => Math.sqrt((p.u-uMiddle)*(p.u-uMiddle)+(p.v-vMiddle)*(p.v-vMiddle));
    pointFront.sort(function(a,b){
        return distFunc(a) - distFunc(b);
    })
    
    // we want to take care of concave angles before ALL the convex angles
    // as to prevent overlap
    let entirelyConvex = true;
    
    function processPoint(pt, edgePoints){
		if(pt.doNotExec){
			return 1;
		}
		
        // start point
        const sPoint = pt.beginning;
        // end point
        const ePoint = pt.end;
        
        // where the start and endPoints are in square coordinates
        const sST = invDir(pt, sPoint.u - pt.u, sPoint.v - pt.v);
        const eST = invDir(pt, ePoint.u - pt.u, ePoint.v - pt.v);
        
        // in square coordinates, we can do normal geometry (hurray!)
        const sAngle = Math.atan2(sST.t, sST.s);
		sPoint.angle = sAngle;
		
        const eAngle = Math.atan2(eST.t, eST.s);
        
        // find counterclockwise difference between start and end angles
        const angleDiff = eAngle >= sAngle ? eAngle - sAngle : 2*Math.PI - (sAngle - eAngle);
		ePoint.angle = sAngle + angleDiff;
        
        // we're shooting for equillateral triangles, so our angles should be as close to Pi/3 as possible
        let sections = Math.round(angleDiff / (Math.PI / 3)+0.4);
		
		let nodeDist = defaultXYZLength;
		
		// sample a bunch of angles to see how the concavity looks in this part of town
		let samples = [];
		for(let a = 0; a < Math.PI * 2; a += Math.PI/8 + .0001){
			let direction = dir(pt, Math.cos(a), Math.sin(a));
			samples.push(dAngle(pt, direction.u, direction.v, xFunc, yFunc, zFunc));
		}
		// take the maximum angle 
		let defactoAngle = Math.max(...samples);
		nodeDist *= 1/(1 + defactoAngle**2);
		
		// but there needs to be a limit...
		nodeDist = nodeDist < defaultXYZLength / 2 ? defaultXYZLength / 2 : nodeDist;
		
		let pointList = [];
		
		// ...but that's for a euclidean plane. Let's add or remove sections as needed
		let adequateNodeNumber = false;
		let count = 0;
		while(!adequateNodeNumber && count < 3){
			count++;
			let arcLength = 0;
			pointList = [sPoint];
			
			for(let nodeCount = 1; nodeCount < sections; nodeCount ++){
				let angle = sAngle + nodeCount * angleDiff/(sections + 1)
				let loc = dir(pt, nodeDist * Math.cos(angle), nodeDist * Math.sin(angle));
				
				let point = plot(xFunc, yFunc, zFunc, pt.u + loc.u, pt.v + loc.v);
				point.angle = angle;
				point.nodeDistFactor = 1;
				
				pointList.push(point);
				arcLength += xyzDist(pointList[pointList.length-1], pointList[pointList.length-2]);
			}
			
			pointList.push(ePoint);
			arcLength += xyzDist(pointList[pointList.length-1], pointList[pointList.length-2]);
			
			// 1.25 and 1 are "empiracly chosen" (aka arbitrary :))
			if(arcLength / sections > nodeDist * 1.25){
				sections++;
				adequateNodeNumber = false;
			}else if(arcLength / sections < nodeDist * 1){
				sections--;
				adequateNodeNumber = false;
			}else{
				adequateNodeNumber = true;
			}
		}
		// now space out pointList so that eash point has close to equal sub-arc lengths to 
		// the right and to the left
		// we'll do this for a set number of iterations, since it's possible for for points 
		// to experience arbitrary movement under arbitrary distances
		const PADDING_ITERATIONS = 10;
		for(let k = 0; k < PADDING_ITERATIONS; k++){
			// every element except the first and last are able to move
			for(let i = 1; i < pointList.length - 1; i++){
				let arcBefore = xyzDist(pointList[i-1], pointList[i]),
					arcAfter = xyzDist(pointList[i+1], pointList[i]),
					ang0 = pointList[i-1].angle,
					ang2 = pointList[i+1].angle,
					ang1 = pointList[i].angle;
				
				// move the node in the direction that arcBefore and arcAfter stipulate
				const newAngle = ang1 + (ang2 - ang0) * 0.5 * (arcAfter - arcBefore) / (arcAfter + arcBefore);
				
				// and while we're here, we might as well fix the nodeDist as well
				// we have to be careful, though, since the whole arbitary movement thing applies here too, except 
				// worse. We'll do a weighted average.
				const nodeDistFactor = .95 * pointList[i].nodeDistFactor + .05 * pointList[i].nodeDistFactor * nodeDist / xyzDist(pt, pointList[i]);
				
				let loc = dir(pt, nodeDistFactor * nodeDist * Math.cos(newAngle), nodeDistFactor * nodeDist * Math.sin(newAngle));
				
				let newPt = null;
				if(k == PADDING_ITERATIONS - 1){
					newPt = plotPlus(xFunc, yFunc, zFunc, pt.u + loc.u, pt.v + loc.v);
				}else{
					newPt = plot(xFunc, yFunc, zFunc, pt.u + loc.u, pt.v + loc.v);
				}
				
				// check if newPt is on the interior of pointFront. If so, remove the point.
				// we'll make use of a simple scanline algorithm for if a point is in a polygon
				const v0 = newPt.v, u0 = newPt.u;
				let crossCount = 0;
				for(const testPt of pointFront){
					// for segment {{a,b}, {c,d}}, intersection with v = v0:
					// segment: {x(t), y(t)} = {a, b} + t( {c,d} - {a,b} ) = {*, v0}
					// {t(c-a), t(d-b)} = {*, v0-b}
					// t = (v0-b)/(d-b)
					// u pos @ t: a + t (c - a) = a+((v0-b)/(d-b))(c-a)
					const a = testPt.u, b = testPt.v,
						c = testPt.end.u, d = testPt.end.v;
					const t = (v0-b)/(d-b);
					const u = a+(v0-b)*(c-a)/(d-b);
					if(u > u0 && t >= 0 && t <= 1){
						crossCount++;
					}
				}
				
				if(crossCount % 2 === 1){
					// it's on the interior (not allowed)
					pointList.splice(i, 1);
					i--;
					continue;
				}
				
				
				newPt.angle = newAngle;
				newPt.nodeDistFactor = nodeDistFactor;
				
				pointList[i] = newPt;
			}
		}
		
		sPoint.end = pointList[1];
		
		// now join pointList into a a set of polygons 
		for(let i = 1; i < pointList.length - 1; i++){
			let p = pointList[i];
			
			makeConnection(p, pointList[i-1]);
			makeConnection(p, pt);
			
			p.beginning = pointList[i-1];
			p.end = pointList[i+1];
			
			// check if it's inside the domain
			if(p.u >= domain.u.min && p.u <= domain.u.max && p.v >= domain.v.min && p.v <= domain.v.max){
				pushToPointFront(p, pointFront);
				p.edgePoint = false;
			}else{
				// we need p in pointFront for use in interior intersection, since a concave point shrinks the acceptable region
				p.doNotExec = true;
				pushToPointFront(p, pointFront);
				edgePoints.push(p);
				p.edgePoint = true;
			}		
			
			polygons.push({
				pts:[pt, p, pointList[i-1]]
			});
		}
		
		ePoint.beginning = pointList[pointList.length - 2];
		
		makeConnection(ePoint, pointList[pointList.length-2]);
		polygons.push({
			pts:[pt, ePoint, pointList[pointList.length-2]]
		});
		
    }
    
    //in order not to mess up the mesh as its graphing, we'll squish the 
    //necessary edge points after the fact
    var edgePoints = [];
    
    var c = 0;
    while(pointFront.length > 0 && c < 40000){
        c++;
		let ptToProcess = pointFront[0];
		
		// this is a slightly clumsy way to skip points that are edgepoints. 
		let i = 0;
		while(ptToProcess.doNotExec){
			i++;
			if(i === pointFront.length){
				pointFront = [];
				break;
			}
			ptToProcess = pointFront[i];
		}
		
        const res = processPoint(ptToProcess, edgePoints);
		
		// res: 1 is the code for "do not delete"
		// it is important to not delete edge points while they 
		// are inactive but still part of the border
		
		// since more points may be added before ptToProcess, we'll search for the right one
		// in this case, a max of 8 (ish) points can be added before, but it's usually zero 
		// so we'll do a linear search 
		let k = 0;
		while(k < pointFront.length && k >= 0 && res !== 1){
			if(pointFront[k] === ptToProcess){
				pointFront.splice(k,1);
				k = -1;
			}else{
				k++;
			}
		}
		
		// see if enough time has elapsed that we should update
		let currentTime = Date.now();
		if(currentTime - lastUpdateTime > updateDelta){
			updateMainThread();
			lastUpdateTime = Date.now();
		}
    }
	
	// now a little post processing
	
	let polysToRemove = [];
	let polysToAdd = [];
	
	// A bit of semi-delauney triangulation
	// find triangles in which the circumcenter lies outside the polygon, 
	// find corresponding diamond then see if switching diagonals is a worthy decision
	for(let k = polygons.length - 1; k >= 0; k--){
		let poly = polygons[k];
		// The circumcenter lies outside the triangle if there is an obtuse angle 
		// (Hey, wikipedia agrees with me)
		// a triangle is obtuse if the sum of the squares two of the sides is less than 
		// the square of the third side
		let obtuse = false,
			obtusePair = [];
		let inds = [[0,1,2],[0,2,1],[1,2,0]];
		for(let triCase of inds){
			let [a,b,c] = triCase.map(x => poly.pts[x]);
			let [s3, s2, s1] = [xyzDist(a,b), xyzDist(b,c), xyzDist(a,c)];
			if(s3**2 > s2**2 + s1**2){
				obtuse = true;
				obtusePair = [a,b];
				break;
			}
		}
		
		if(obtuse){
			let [p1, p2] = obtusePair;
			// search for common connections (there should be 2 of them)
			let set1 = p1.neighbors.map(x => x.pt),
				set2 = p2.neighbors.map(x => x.pt);
			
			let common = set1.filter(x => set2.indexOf(x) !== -1);
			
			// it is usually two, since the whole thing is triangles. 
			// if it isn't 2, then something weird happened (but it is possible), so we won't mess 
			// with it
			if(common.length === 2){
				// if the other diagonal is shorter than the one currently there...
				if(xyzDist(...common) < xyzDist(p1, p2)){
					// remove current connection
					removeConnection(p1, p2);
					
					// add the new one
					removeConnection(...common);
					makeConnection(...common);
					
					// remove the offending polygons and add new ones
					polysToRemove.push([p1,  p2]);
					
					polysToAdd.push({
						pts:[p1, ...common]
					});
					
					polysToAdd.push({
						pts:[p2, ...common]
					});
				}
			}
		}
	}
	
	for(let poly of polysToAdd){
		polygons.push(poly);
	}
	
	// it is very important that the appropriate polygons be removed AFTER the other polygons 
	// have been added. This way, the order can be preserved while getting rid of 
	// polygons that were created at a previous step in the above logic
	for(let [p1, p2] of polysToRemove){
		for(var k = polygons.length - 1; k >= 0; k--){
			if(polygons[k].pts.indexOf(p1) !== -1 && polygons[k].pts.indexOf(p2) !== -1){
				polygons.splice(k, 1);
			}
		}
	}
    
    // move all the edge points back into the domain
    for(var k = 0; k < edgePoints.length; k++){
        const pt = edgePoints[k];
        let u = pt.u, v = pt.v;
        u = u > domain.u.max ? domain.u.max : u;
        u = u < domain.u.min ? domain.u.min : u;
        v = v > domain.v.max ? domain.v.max : v;
        v = v < domain.v.min ? domain.v.min : v;
        
        pt.u = u;
        pt.v = v;
        
        const newPt = plotPlus(xFunc, yFunc, zFunc, pt.u, pt.v);
        pt.x = newPt.x;
        pt.y = newPt.y;
        pt.z = newPt.z;
		pt.deriv1 = newPt.deriv1;
		pt.deriv2 = newPt.deriv2;
    }
	
	// we also need to fix the edge point control points
	for(let edge of edgePoints){
		// This is not a for ... of loop to avoid concurrent modification bugs
		for(let k = edge.neighbors.length - 1; k >= 0; k--){
			// remaking the connection resets the control point
			let otherPt = edge.neighbors[k].pt;
			removeConnection(edge, otherPt);
			makeConnection(edge, otherPt);
		}
	}
	
	onFinish();
}

function generatingVecs(refPt){
	//we want (v1.u * |du|)^2 + (v1.v * |dv|)^2 == 1^2, and the same for v2
	//for v1, we just assume v = 0
	var du = refPt.deriv1.du,
		dv = refPt.deriv1.dv
	var v1 = {
		u: 1 / magnitude(du),
		v:0
	};
	//this is essentially a projection
	//for future reference, think of du and dv embedded in xyz space, need new vector
	//pointing "toward" dv but perpendicular to du, in uv coordinates
	var v2 = {
		u:-dot(du, dv) / dot(du, du),
		v:1
	}
	//now scale v2 to its length is 1
	var sc = 1 / magnitude( add( scalar(v2.u, du), scalar(v2.v, dv) ) );
	v2.u *= sc;
	v2.v *= sc;
	
	return [v1,v2];
}

// returns the uv coordinates of a coordinate specified in perpendicular, normalized
//  coordinates, with the first coordinate parallel to the du vector
function dir(refPt, s,t){
	var vecs = generatingVecs(refPt);
	var v1 = vecs[0];
	var v2 = vecs[1];
	
	return {
		u: v1.u * s + v2.u * t,
		v: v1.v * s + v2.v * t
	};
}

// finds change in angle per unit (xyz) vector (uDir, vDir)
function dAngle(pt, uDir, vDir, xFunc, yFunc, zFunc){
	const delta = Math.min((domain.u.max-domain.u.min)/1e6, (domain.v.max-domain.v.min)/1e6);
	const pt2 = plotPlus(xFunc, yFunc, zFunc, pt.u + uDir*delta, pt.v + vDir*delta);
	
	const ptVec = add(scalar(uDir, pt.deriv1.du), scalar(vDir, pt.deriv1.dv));
	const pt2Vec = add(scalar(uDir, pt2.deriv1.du), scalar(vDir, pt2.deriv1.dv));
	
	return angleBetween(ptVec, pt2Vec) / delta;
}

//inverse of dir function
function invDir(refPt, u,v){
	var vecs = generatingVecs(refPt);
	var v1 = vecs[0];
	var v2 = vecs[1];
	//just a linear system, no problem
	var den = v2.u*v1.v - v1.u*v2.v;
	return {
		s: -(u*v2.v - v2.u*v)/den,
		t: -(v1.u*v-u*v1.v)/den
	};
}

function connectLoop(p1,p2,p3){
	makeConnection(p1,p2);
	makeConnection(p2,p3);
	makeConnection(p1,p3);
}

function calcAngle(pt){
	//start point
	var sPoint = pt.beginning;
	//end point
	var ePoint = pt.end;
	
	//where the start and endPoints are in square coordinates
	var sST = invDir(pt, sPoint.u - pt.u, sPoint.v - pt.v);
	var eST = invDir(pt, ePoint.u - pt.u, ePoint.v - pt.v);
	
	//in square coordinates, we can do normal geometry (hurray!)
	var sAngle = Math.atan2(sST.t, sST.s);
	var eAngle = Math.atan2(eST.t, eST.s);
	
	//find counterclockwise difference between start and end angles
	var angleDiff = eAngle >= sAngle ? eAngle - sAngle : 2*Math.PI - (sAngle - eAngle);
	return angleDiff;
}

//determines if the line segment (base, pt) is in a clockwise direction to (base, pt2) in uv coordinates
//this is determined by the direction of the cross product (right hand rule)
function isClockwise(pt, base, pt2){
	//since the "z" (w?) component of all of our vectors is zero, the cross product is simply
	//det({{i,j,k},{a,b,0},{c,d,0}}) = ad - bc (the so-called "2d cross product")
	var a = pt.u - base.u,
		b = pt.v - base.v,
		c = pt2.u - base.u,
		d = pt2.v - base.v;
	return a*d - b*c > 0;
}

//returns the dot product of the vectors formed by (base, pt) and (base, pt2)
function uvDot(pt,base, pt2){
	var a = pt.u - base.u,
		b = pt.v - base.v,
		c = pt2.u - base.u,
		d = pt2.v - base.v;
	return a*c+b*d;
}

function pushToPointFront(pt, pointFront){
	//do a binary search to find where the pt should go
	var d = distFunc(pt);
	//bounds of index, low and high (inclusive on both)
	var low = 0;
	var high = pointFront.length-1;
	if(d < distFunc(pointFront[low])){
		pointFront.splice(0,0,pt);
		return;
	}else if(d > distFunc(pointFront[high])){
		pointFront.push(pt);
		return;
	}
	
	while(high - low > 1){
		var mid = Math.floor((low + high) / 2);
		var val = distFunc(pointFront[mid]);
		if(val > d){
			high = mid;
		}else if(val < d){
			low = mid;
		}else{
			low = mid-1;
			high = mid;
		}
	}
	
	//splice inserts before the index
	pointFront.splice(high,0,pt);
}

function makeConnection(pt1, pt2){
    if(!pt2 || !pt1){
        throw new Error('pt1 or pt2 is null')
    }
	// for a quadratic bezier curve, the control point should be 
	// the intersection of the first degree linear approximations 
	// for the two points in the direction of the other (since bezier 
	// curves are tangent to the control lines at the end points)
	
	// for a parameterized surface of u and v, grad(f(u,v)) is perpendicular 
	// to the tangent line, so from the tangent plane, project (pt2 - pt1)
	// then normalize
	
	const p1Grad = cross(pt1.deriv1.du, pt1.deriv1.dv),
		p2Grad = cross(pt2.deriv1.du, pt2.deriv1.dv);
	
	const p1Dir = sub(pt2, pt1);
	const p1Vec = sub(p1Dir, project(p1Dir, p1Grad));
	
	// we need ((pt1 + p1Vec) - pt2) . pt2_grad == 0
	// so given p1Vec = k (a, b, c), we have 
	// pt2_gradx * (pt1.x + k a - pt2.x) + pt2_grady * (pt1.y + k b - pt2.y) ... == 0
	// k == ( pt2_gradx(pt2.x - pt1.x) + pt2_grady(pt2.y - pt1.y) ...) / ( a pt2_gradx + b pt2_grady ... )
	// k == pt2_grad . (pt2 - pt1) / (p1Vec . pt2_grad) (curious...)
	
	const k = dot(p2Grad, sub(pt2, pt1)) / dot(p1Vec, p2Grad);
	
	let controlPt = null;
	
	// there are some cases where the only way to do a quadratic bezier is to go past the point and come back
	// it the angle between pt1, pt2 and controlPt > 90, go with a straight line
	if(k !== null && !isNaN(k)){
		controlPt = add(pt1, scalar(k, p1Vec));
	}
	
	if(k === null || isNaN(k) || dot(sub(pt1,pt2), sub(controlPt, pt2)) < 0 || dot(sub(pt2,pt1), sub(controlPt, pt1)) < 0){
		// default to a straight line
		controlPt = scalar(.5, add(pt1, pt2));
	}
	
    pt1.neighbors.push({
        draw:true,
        pt:pt2,
		controlPt:controlPt
    });
    pt2.neighbors.push({
        draw:false,
        pt:pt1,
		controlPt:controlPt
    });
}

function removeConnection(pt1, pt2){
    for(var j = pt1.neighbors.length - 1; j >= 0; j--){
        if(pt1.neighbors[j].pt === pt2){
            pt1.neighbors.splice(j,1);
        }
    }
    for(var k = pt2.neighbors.length - 1; k >= 0; k--){
        if(pt2.neighbors[k].pt === pt1){
            pt2.neighbors.splice(k,1);
        }
    }
}

// plot the point, computes its 1st partial derivatives (dx/du, dx/dv etc) and its 2nd parial derivatives (dx^2/du, etc)
function plotPlus(xfunc, yfunc, zfunc, u,v,delta){
    if(!delta){
        delta = Math.min((domain.u.max-domain.u.min)/1e8, (domain.v.max-domain.v.min)/1e8);
    }
    var p1 = plot(xfunc, yfunc, zfunc, u, v);
    var pu = plot(xfunc, yfunc, zfunc, u-delta, v);
    var pu2 =plot(xfunc, yfunc, zfunc, u+delta, v);
    var pv = plot(xfunc, yfunc, zfunc, u, v-delta);
    var pv2 =plot(xfunc, yfunc, zfunc, u, v+delta);
    var ud1 = scalar(1/delta,sub(p1,pu));
    var ud2 = scalar(1/delta,sub(pu2,p1));
    var vd1 = scalar(1/delta,sub(p1,pv));
    var vd2 = scalar(1/delta,sub(pv2,p1));
    
    return {
        x:p1.x,
        y:p1.y,
        z:p1.z,
        u:p1.u,
        v:p1.v,
        neighbors:[],
        deriv1:{
            //average the two 1st derivative measurements
            du:scalar(1/2, add(ud1,ud2)),
            dv:scalar(1/2, add(vd1,vd2))
        },
        deriv2:{
            du:scalar(1/delta, sub(ud2,ud1)), 
            dv:scalar(1/delta, sub(vd2,vd1))
        }
    };
}

//compiled x,y,z functions
function plot(cX, cY, cZ, u,v){
    var scope = {
            u:u,
            v:v,
            x:null,
            y:null,
            z:null
        }
		if(domain.animationVars){
			for(var j = 0; j < animationVars.length; j++){
				scope[domain.animationVars[j].name] = domain.animationVars[j].value;
			}
		}
        
        var point;
        
        if(domain.currentSystem.indexOf('parametric') !== -1){
            //the parametric body is stored in the cX function by convention
            cX.eval(scope)
            point = {
                u:u,
                v:v,
            };
            [0,1,2].forEach(i => 
                point[domain.expressionInfo.expression.vars[i]] = getRealPart(math.subset(scope.x, math.index(i)))
            );
            if(domain.currentSystem.indexOf('cylindrical') !== -1){
                point.x = point.rho * Math.cos(point.phi);
                point.y = point.rho * Math.sin(point.phi)
            }else if(domain.currentSystem.indexOf('spherical') !== -1){
                point.x = point.r * Math.cos(point.theta) * Math.cos(point.phi);
                point.y = point.r * Math.sin(point.theta) * Math.cos(point.phi);
                point.z = point.r * Math.sin(point.phi);
            }
        }else{
            cX.eval(scope);
            cY.eval(scope);
            cZ.eval(scope);
            point = {u:u,v:v,
            x:getRealPart(scope.x),y:getRealPart(scope.y),z:getRealPart(scope.z)};
        }
        point.x = spreadCoord(point.x, domain.x.min, domain.x.max, domain.x.spread);
        point.y = spreadCoord(point.y, domain.y.min, domain.y.max, domain.y.spread);
        point.z = spreadCoord(point.z, domain.z.min, domain.z.max, domain.z.spread);
        point.neighbors = [];
        return point;
}

function findParametricEdge(realP, nonRealP, xFunc, yFunc, zFunc, iterations){
    //when we have completed the necessary amount of iterations,
    //  return the real end of the interval containing the boundary
    if(iterations === 0){
        return realP;
    }
    
    //find the midpoint of realP and nonRealP in terms of parameterized variables
    var u = (realP.u + nonRealP.u)/2;
    var v = (realP.v + nonRealP.v)/2;
    var scope = {
        u:u,
        v:v,
        x:null,
        y:null,
        z:null
    }
    
    //set any animation variables
    for(var j = 0; j < animationVars.length; j++){
        scope[animationVars[j].name] = animationVars[j].value;
    }
    
    //evaluate function at new point (twice to account for function like x = u, y = x, z = y)
    xFunc.eval(scope);
    yFunc.eval(scope);
    zFunc.eval(scope);
    xFunc.eval(scope);
    yFunc.eval(scope);
    zFunc.eval(scope);
    //create new point containing xyz and uv coordinates for midppoint
    var inBetween = {x:getRealPart(scope.x),y:(scope.y),z:getRealPart(scope.z)};
    makeFiniteIfInfinate(inBetween)
    
    //domain stretching for non-cubic domains
    inBetween.x = spreadCoord(inBetween.x, domain.x.min, domain.x.max, domain.x.spread);
    inBetween.y = spreadCoord(inBetween.y, domain.y.min, domain.y.max, domain.y.spread);
    inBetween.z = spreadCoord(inBetween.z, domain.z.min, domain.z.max, domain.z.spread);
    inBetween.u = u;
    inBetween.v = v;
    
    //return new interval
    if(isNonReal(inBetween)){
        return findParametricEdge(realP, inBetween, xFunc, yFunc, zFunc, iterations - 1);
    }else{
        return findParametricEdge(inBetween, nonRealP, xFunc, yFunc, zFunc, iterations - 1);
    }
}

function spreadCoord(val, min, max, spread){
    var center = (min+max)/2;
    var valRel = val - center;
    return valRel*spread + center;
}

function angleBetween(v1, v2){
    var dotP = dot(v1,v2);
    var angle = Math.acos(dotP/(magnitude(v1)*magnitude(v2)));
	// dotP/magnitu... can sometimes be a little more than one due to floating point error
	if(isNaN(angle)){
		return 0;
	}else if(angle > Math.PI){
        return Math.PI*2 - angle;
    }else{
        return angle;
    }
}

function sub(a,b){
    return {x: a.x - b.x, y: a.y - b.y, z: a.z - b.z};
}

function add(a,b){
    return sub(a,scalar(-1,b));
}

function scalar(s, vec){
    return {x: vec.x*s, y: vec.y*s, z: vec.z*s};
}

// v1 onto v2
function project(v1,v2){
	return scalar(dot(v1,v2)/dot(v2,v2), v2);
}

function magnitude(v){
    return Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z);
}

function dot(a,b){
    return a.x*b.x+a.y*b.y+a.z*b.z;
}

function cross(a,b){
    return {
        x:a.y*b.z-a.z*b.y,
        y:a.z*b.x-a.x*b.z,
        z:a.x*b.y-a.y*b.x
    };
}

function uvDist(a,b){
    return Math.sqrt(Math.pow(a.u-b.u,2) + Math.pow(a.v-b.v,2));
}

function xyzDist(a,b){
    return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2);
}

function getRealPart(val){
    return val.im ? undefined : val;
}

