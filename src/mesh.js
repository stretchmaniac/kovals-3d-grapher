/*global math*/

self.importScripts('../libs/math.js');

let polygons = [];
// what is the index of the next polygon to be passed back to the 
// main thread
let polyUpdateIndex = 0;
let lineUpdateIndex = 0;
let domain = {};
let distFunc = null;
let extrema = null;

onmessage = function(e){
	let [requestType, ...args] = e.data;
	if(requestType === 'GRAPH'){
		graphParametricFunction2(...args, function(){
			postMessage(['FINISHED', getTotalPolyData(), getTotalLineData(), extrema]);
		});
	}
}

function updateMainThread(){
	postMessage(['POLYGON_UPDATE', getPartialPolyData(), getPartialLineData()]);
}

function getTotalPolyData(){
	// put the data in polygons into an array
	let polyData = [];
	for(let poly of polygons){
		polyDataPt(polyData, poly);
	}
	
	return polyData;
}

function getTotalLineData(){
	let lineData = [];
	for(let line of lines){
		lineDataPt(lineData, line);
	}
	
	return lineData;
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

function getPartialLineData(){
	let lineData = [];
	for(let k = lineUpdateIndex; k < lines.length; k++){
		lineDataPt(lineData, lines[k]);
	}
	
	lineUpdateIndex = lines.length;
	return lineData;
}

function polyDataPt(polyData, poly){
	let c = 0;
	for(let p of poly.pts){
		polyData.push(p.x);
		polyData.push(p.y);
		polyData.push(p.z);
		
		updateExtrema(p);
		
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

function lineDataPt(lineData, line){
	for(let p of line.pts){
		lineData.push(p.x, p.y, p.z);
		
		updateExtrema(p);
	}
}

function updateExtrema(p){
	if(!extrema){
		extrema = {
			x:{min: domain.center.x, max: domain.center.x},
			y:{min: domain.center.y, max: domain.center.y},
			z:{min: domain.center.z, max: domain.center.z}
		}
	}
	
	// update extrema for axes purposes
	if(!p.outsideDomain){
		extrema.x.min = extrema.x.min > p.x ? p.x : extrema.x.min;
		extrema.x.max = extrema.x.max < p.x ? p.x : extrema.x.max;
		extrema.y.min = extrema.y.min > p.y ? p.y : extrema.y.min;
		extrema.y.max = extrema.y.max < p.y ? p.y : extrema.y.max;
		extrema.z.min = extrema.z.min > p.z ? p.z : extrema.z.min;
		extrema.z.max = extrema.z.max < p.z ? p.z : extrema.z.max;
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
	// for 1 dimensional functions (e.g. (x,y,z) = u(1,1,1))
	lines = [];
	
	polyUpdateIndex = 0;
    
    // center of domain, the seed point
    // note that this is NOT always foolproff ==> z = rho, rho in [-10, 10]
    const uMiddle = (domain.u.max + domain.u.min) / 2,
        vMiddle = (domain.v.max + domain.v.min) / 2;
    
    let initPoint = plotPlus(xFunc, yFunc, zFunc, uMiddle, vMiddle);
	
	let pointFront = null;
	
	if(magnitude(initPoint.deriv1.du) === 0 || magnitude(initPoint.deriv1.dv) === 0){
		// this is a one dimensional line, start it as such
		
		let changeVar = magnitude(initPoint.deriv1.du) === 0 ? 'v' : 'u';
		
		let dir = {
			u:0,
			v:0
		}
		dir[changeVar] += defaultXYZLength / 10;
		
		let initPoint2 = plotPlus(xFunc, yFunc, zFunc, uMiddle + dir.u, vMiddle + dir.v);
		
		makeConnection(initPoint2, initPoint);
		
		initPoint.beginning = initPoint2;
		initPoint.end = initPoint2;
		initPoint.oneDDir = -1;
		
		initPoint2.beginning = initPoint;
		initPoint2.end = initPoint;
		initPoint2.oneDDir = 1;
		
		lines.push({
			pts:[initPoint, initPoint2]
		});
		
		pointFront = [initPoint, initPoint2];
	}else{
		
		//we have (x(u,v), y(u,v), z(u,v)) ≈ u du + v dv, so a linear transformation (a plane)
		//in order for a parameterization (x(s,t), y(s,t), z(s,t)) such that a change in s and t corresponds to 
		//an equal change in x,y and z, we need s = u du, t = v dv, or (u(s,t), v(s,t)) = (s / |du|, t / |dv|)
		// make this triangle the smallest possible size (see conversion of alanConstant later)
		defaultXYZLength *= .2;
		let vec = dir(initPoint, defaultXYZLength, 0);
		
		let initPoint2 = plotPlus(xFunc, yFunc, zFunc, uMiddle + vec.u, vMiddle + vec.v);
		vec = dir(initPoint, defaultXYZLength*.5, defaultXYZLength*Math.sqrt(3)/2)
		let initPoint3 = plotPlus(xFunc, yFunc, zFunc, uMiddle + vec.u, vMiddle + vec.v)
		
		defaultXYZLength *= 5;
		
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
		
		pointFront = [initPoint, initPoint2, initPoint3];
	}
    distFunc = p => Math.sqrt((p.u-uMiddle)*(p.u-uMiddle)+(p.v-vMiddle)*(p.v-vMiddle));
    pointFront.sort(function(a,b){
        return distFunc(a) - distFunc(b);
    })
    
    // we want to take care of concave angles before ALL the convex angles
    // as to prevent overlap
    let entirelyConvex = true;
    
    function processPoint(pt, edgePoints, logResults){
		if(pt.doNotExec){
			return 1;
		}
		
		// I feel like I'm coding desmos here...
		if(magnitude(pt.deriv1.du) === 0 | magnitude(pt.deriv1.dv) === 0){
			// this is a one dimensional function, so make it a line instead of a polygon 
			let changeVar = magnitude(pt.deriv1.du) === 0 ? 'v' : 'u';
			let dir = {
				u:0,
				v:0
			};
			dir[changeVar] = 1/magnitude(pt.deriv1['d'+changeVar]);
			
			// continue in the same direction as pt 
			if(!pt.oneDDir){
				// must be coming from a non-one dimensional surface
				// decide based on the average of its neighbors
				let averageChangeVar = pt.neighbors.map(x=>x.pt[changeVar]).reduce((a,b)=>a+b,0);
				if(averageChangeVar > pt[changeVar]){
					pt.oneDDir = -1;
				}else{
					pt.oneDDir = 1;
				}
			}
			dir[changeVar] *= pt.oneDDir;
			
			let newPt = plotPlus(xFunc, yFunc, zFunc, pt.u + dir.u, pt.v + dir.v);
			
			// while we could do something fancy to nodedist, in reality a one 
			// dimensional line is going to be blazing fast anyway, so just make
			// is sufficiently small 
			
			let actualNewPt = makeNodeDist(pt, newPt, defaultXYZLength/10, dir, xFunc, yFunc, zFunc);
			makeConnection(pt, actualNewPt);
			if(!actualNewPt.outsideDomain){
				lines.push({
					pts:[pt,actualNewPt]
				});
			}
			// in case this is an isolated pole or something, be able to 
			// resume surface plotting (see angleDiff definition below, will
			// result in 2pi diff)
			actualNewPt.beginning = pt;
			actualNewPt.end = pt;
			actualNewPt.oneDDir = pt.oneDDir;
			
			// if outside uv domain, don't push 
			let u = actualNewPt.u, 
				v = actualNewPt.v;
			if(u <= domain.u.max && u >= domain.u.min && v <= domain.v.max && v >= domain.v.min){
				pushToPointFront(actualNewPt, pointFront);
			}
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
		
		let pointList = [];
		
		let averageNeighborLength = pt.neighbors.map(x=>xyzDist(x.pt, pt)).reduce((a,b)=>a+b, 0) / pt.neighbors.length;
		// this is an important step
		// for non-continuous functions like floor(x), 
		// there will massive polygons (initially) no matter what
		// we want them to resume normally
		if(averageNeighborLength > defaultXYZLength){
			averageNeighborLength = defaultXYZLength;
		}
		
		// ...but that's for a euclidean plane. Let's add or remove sections as needed
		let adequateNodeNumber = false;
		let count = 0;
		let prevAlanConst = null;
		while(!adequateNodeNumber && count < 5){
			count++;
			let arcLength = 0;
			pointList = [sPoint];
			
			for(let nodeCount = 1; nodeCount < sections; nodeCount ++){
				let angle = sAngle + nodeCount * angleDiff/(sections + 1)
				let loc = dir(pt, nodeDist * Math.cos(angle), nodeDist * Math.sin(angle));
				
				if(pt.u+loc.u < -1000){
					console.log(pt.deriv1.du, pt.deriv1.dv, nodeDist, angle);
				}
				let point = plotPlus(xFunc, yFunc, zFunc, pt.u + loc.u, pt.v + loc.v);
				point.angle = angle;
				point.nodeDistFactor = 1;
				
				pointList.push(point);
				arcLength += xyzDist(pointList[pointList.length-1], pointList[pointList.length-2]);
			}
			
			pointList.push(ePoint);
			arcLength += xyzDist(pointList[pointList.length-1], pointList[pointList.length-2]);
			
			// compute alanConstant, a good way to figure out how small the mesh should be :) 
			// (it's invariant on a sphere no matter the grid size as ~1/r)
			// (in this sense, it's equal to curvature for radially symmetric points)
			// (but is able to be used for things topologically flat)
			// (like z = sin 5x )
			let orderedPoints = pointList.slice(1, pointList.length - 1).concat(pt.neighbors.map(x=>x.pt));
			orderedPoints.sort((a,b) => {
				return Math.atan2(a.v-pt.v,a.u-pt.u) - Math.atan2(b.v-pt.v,b.u-pt.u);
			});
			
			let alanConstant = 0;
			for(let i = 0; i < orderedPoints.length-1; i++){
				let firstPt = orderedPoints[i],
					secondPt = orderedPoints[i+1];
				if(xyzDist(firstPt, secondPt) !== 0){
					alanConstant += Math.abs(angleBetween(normal(firstPt), normal(secondPt))) / xyzDist(firstPt, secondPt);
				}
				if(isNaN(alanConstant)){
					console.log('point '+i+' is the culprit',firstPt, secondPt,pointList[0],pointList[pointList.length-1],count,angleDiff,pt,sections,...pointList,xyzDist(firstPt, secondPt));
				}
			}
			
			let finalPt1 = orderedPoints[orderedPoints.length-1],
				finalPt2 = orderedPoints[0];
			alanConstant += Math.abs(angleBetween(normal(finalPt1), normal(finalPt2))) / xyzDist(finalPt1, finalPt2);
			
			//use the minimum alanConstant
			if(!prevAlanConst){
				prevAlanConst = alanConstant;
			}
			if(prevAlanConst && prevAlanConst < alanConstant){
				alanConstant = prevAlanConst;
			}
			prevAlanConst = alanConstant;
			
			// now update nodeDist
			nodeDist = defaultXYZLength * (Math.E**(-0.35*alanConstant)/1.2 + .2);
			
			if(nodeDist < averageNeighborLength / 1.5){
				nodeDist = averageNeighborLength / 1.5;
			}
			if(nodeDist > averageNeighborLength * 1.5){
				nodeDist = averageNeighborLength * 1.5;
			}
			
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
		
		if(logResults){
			console.log(pt.u,pt.v,pt.x,pt.y,pt.z);
			console.log(pt.u,pointList.length);
			console.log(pt.u, 'dist='+xyzDist(pointList[0], pointList[1]));
			console.log(pt.u,pointFront.indexOf(pointList[0]),pointFront.indexOf(pointList[pointList.length-1]));
		}
		
		// now space out pointList so that eash point has close to equal sub-arc lengths to 
		// the right and to the left
		// we'll do this for a set number of iterations, since it's possible for for points 
		// to experience arbitrary movement under arbitrary distances
		const PADDING_ITERATIONS = 10;
		for(let k = 0; k < PADDING_ITERATIONS; k++){
			// every element except the first and last are able to move
			for(let i = 1; i < pointList.length - 1; i++){
				let tp1 = sub(pointList[i-1], pt),
					tp2 = sub(pointList[i+1], pt);
				let np1 = pt + scalar(nodeDist/magnitude(tp1), tp1),
					np2 = pt + scalar(nodeDist/magnitude(tp2), tp2);
				let arcBefore = xyzDist(tp1, pointList[i]),
					arcAfter = xyzDist(tp2, pointList[i]),
					ang0 = pointList[i-1].angle,
					ang2 = pointList[i+1].angle,
					ang1 = pointList[i].angle;
				let ang0Length = magnitude(tp1),
					ang2Length = magnitude(tp2);
				
				// move the node in the direction that arcBefore and arcAfter stipulate
				// take into account the length of each leg
				let newAngle = (ang0*ang0Length + ang2*ang2Length)/(ang0Length + ang2Length);
				
				let loc = dir(pt, nodeDist * Math.cos(newAngle), nodeDist * Math.sin(newAngle));
				
				let newPt = null;
				if(k == PADDING_ITERATIONS - 1){
					newPt = plotPlus(xFunc, yFunc, zFunc, pt.u + loc.u, pt.v + loc.v);
				}else{
					newPt = plotPlus(xFunc, yFunc, zFunc, pt.u + loc.u, pt.v + loc.v);
				}
				
				if(isNaN(newPt.x)){
					console.log(newPt.u,newPt.v,pt.u,pt.v,loc.u,loc.v,newAngle,nodeDist);
				}
				
				// it is imperative that the length actually be close to nodeDist
				newPt = makeNodeDist(pt, newPt, nodeDist, loc, xFunc, yFunc, zFunc);
				newPt.base = pt;
				
				if(logResults){
					console.log(newPt.u,newPt.v);
				}
				
				if(withinPolygon(newPt, pointFront)){
					// it's on the interior (not allowed)
					if(logResults){
						console.log(pt.u,k,'deleting...');
						console.log(pt.u, newPt.u, newPt.v);
						console.log(pt.u, xyzDist(newPt,pointList[0])+xyzDist(newPt,pointList[pointList.length-1]));
					}
					pointList.splice(i, 1);
					i--;
					continue;
				}
				
				newPt.angle = newAngle;
				newPt.direction = loc;
				
				pointList[i] = newPt;
			}
		}
		
		sPoint.end = pointList[1];
		
		let crossingFound = false;
		// now join pointList into a a set of polygons 
		for(let i = 1; i < pointList.length - 1; i++){
			let p = pointList[i];
			
			makeConnection(p, pointList[i-1]);
			makeConnection(p, pt);
			
			p.beginning = pointList[i-1];
			p.end = pointList[i+1];
			
			let outsideUVDomain = false;
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
				outsideUVDomain = true;
			}
			
			if(!isEntirelyInvalid([pt, p, pointList[i-1]])){
				polygons.push({
					pts:[pt, p, pointList[i-1]]
				});
				}
		}
		
		ePoint.beginning = pointList[pointList.length - 2];
		
		makeConnection(ePoint, pointList[pointList.length-2]);
		if(!isEntirelyInvalid([pt, ePoint, pointList[pointList.length-2]])){
			polygons.push({
				pts:[pt, ePoint, pointList[pointList.length-2]]
			});
		}
    }
    
    //in order not to mess up the mesh as its graphing, we'll squish the 
    //necessary edge points after the fact
    var edgePoints = [];
	let postPointFront = [];
    
    var c = 0;
	//213
    while(pointFront.length > 0 && c < 40000){
        c++;
		let ptToProcess = pointFront[0];
		
		// this is a slightly clumsy way to skip points that are edgepoints. 
		let i = 0;
		while(ptToProcess.doNotExec){
			i++;
			if(i === pointFront.length){
				postPointFront = pointFront;
				pointFront = [];
				break;
			}
			ptToProcess = pointFront[i];
		}
		
        const res = processPoint(ptToProcess, edgePoints, false);
		
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
		
		// don't use "deleted" polygons (this duplicates some of the actions)
		let moveOn = false;
		for(let deleted of polysToRemove){
			if(poly.pts.indexOf(deleted[0]) !== -1 && poly.pts.indexOf(deleted[1]) !== -1){
				moveOn = true;
				break;
			}
		}
		if(moveOn){
			continue;
		}
		
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
					
					if(!isEntirelyInvalid([p1, ...common])){
						polysToAdd.push({
							pts:[p1, ...common]
						});
					}
					
					if(!isEntirelyInvalid([p2, ...common])){
						polysToAdd.push({
							pts:[p2, ...common]
						});
					}
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
	let polyLengthB = polygons.length;
	for(let [p1, p2] of polysToRemove){
		for(var k = polygons.length - 1; k >= 0; k--){
			if(polygons[k].pts.indexOf(p1) !== -1 && polygons[k].pts.indexOf(p2) !== -1){
				polygons.splice(k, 1);
			}
		}
	}
	
	let overlapUDelta = (domain.u.max - domain.u.min) / 1e3,
		overlapVDelta = (domain.v.max - domain.v.min) / 1e3;
    // move all the edge points back into the domain
    for(var k = 0; k < edgePoints.length; k++){
        const pt = edgePoints[k];
        let u = pt.u, v = pt.v;
		
		u = u > domain.u.max ? domain.u.max + overlapUDelta : u;
		u = u < domain.u.min ? domain.u.min - overlapUDelta : u;
		v = v > domain.v.max ? domain.v.max + overlapVDelta : v;
		v = v < domain.v.min ? domain.v.min - overlapVDelta : v;
        
        pt.u = u;
        pt.v = v;
        
        const newPt = plotPlus(xFunc, yFunc, zFunc, pt.u, pt.v);
        pt.x = newPt.x;
        pt.y = newPt.y;
        pt.z = newPt.z;
		pt.deriv1 = newPt.deriv1;
    }
	
	// there were some issues with the corners not being filled in. 
	// this solution checks each corner to see if it is in pointFront, 
	// and if not, adds it and connects it to the nearest u axis edge point
	// and v axis edge point (to form a triangle)
	
	const corners = [
		[domain.u.min - overlapUDelta, domain.v.min - overlapVDelta],
		[domain.u.min - overlapUDelta, domain.v.max + overlapVDelta],
		[domain.u.max + overlapUDelta, domain.v.min - overlapVDelta],
		[domain.u.max + overlapUDelta, domain.v.max + overlapVDelta]
	];
	
	for(let corner of corners){
		// check if corner is in pointFront
		let [cornerU, cornerV] = corner;
		if(!withinPolygon({u: cornerU, v: cornerV}, postPointFront)){
			// find the nearest edge point in the u and v direction 
			let wiggleFudgeU = (domain.u.max - domain.u.min) / 1e7;
			let wiggleFudgeV = (domain.v.max - domain.v.min) / 1e7;
			let bestU = null,
				bestV = null;
			
			for(let edge of edgePoints){
				if(Math.abs(edge.u - cornerU) < wiggleFudgeU && (bestV === null || Math.abs(edge.v - cornerV) < Math.abs(bestV.v - cornerV))){
					bestV = edge;
				}
				if(Math.abs(edge.v - cornerV) < wiggleFudgeV && (bestU === null || Math.abs(edge.u - cornerU) < Math.abs(bestU.u - cornerU))){
					bestU = edge;
				}
			}
			
			if(bestV && bestU){
				const cornerPoint = plotPlus(xFunc, yFunc, zFunc, cornerU, cornerV);
				makeConnection(cornerPoint, bestV);
				makeConnection(cornerPoint, bestU);
				// in case they're already connected
				removeConnection(bestV, bestU);
				makeConnection(bestV, bestU);
				
				polygons.push({
					pts:[bestU, bestV, cornerPoint]
				});
			}
		}
	}
	
	// remove all polygons that are entirely nonreal, outside the domain or infinite
	let ptsToFix = new Set();
	for(let i = polygons.length - 1; i >= 0; i--){
		let poly = polygons[i];
		let entirelyNonValid = true, 
			validPts = [],
			invalidPts = [];
		for(let testP of poly.pts){
			if(!testP.infinite && testP.real && !testP.outsideDomain){
				entirelyNonValid = false;
			}
			if(testP.infinite || !testP.real || testP.outsideDomain){
				invalidPts.push(testP);
			}else{
				validPts.push(testP);
			}
		}
		
		if(entirelyNonValid){
			polygons.splice(i, 1);
		}else if(invalidPts.length > 0){
			// move the points 'till they're valid again
			for(let p of invalidPts){
				ptsToFix.add(p);
			}
		}
	}
	for(let p of ptsToFix){
		// find nearest valid neighbors
		let valid = p.neighbors.filter(x=>x.pt.real && !x.pt.infinite && !x.pt.outsideDomain).sort((a,b) => xyzDist(a.pt,p) - xyzDist(b.pt,p))[0];
		let newP = findParametricEdge(valid.pt, p, x => !x.infinite && x.real && !x.outsideDomain, xFunc, yFunc, zFunc, 30);
		p.x = newP.x;
		p.y = newP.y;
		p.z = newP.z;
		p.real = newP.real;
		p.infinite = newP.infinite;
		p.outsideDomain = newP.outsideDomain;
		p.u = newP.u;
		p.v = newP.v;
		p.base = newP.base;
		p.discontinuous = newP.discontinuous;
		p.deriv1 = valid.pt.deriv1;
	}
	
	let discPolysToAdd = [];	
	// fix any points that "gave up" in makeNodeDist
	// this indicates a discontinuity in most circumstances
	// and when it's not, there won't be much of a difference
	for(let i = polygons.length - 1; i >= 0; i--){
		// if a polygon includes the base and the discontinuous point, remove the polygon
		let poly = polygons[i];
		let p = poly.pts[0],
			np = poly.pts[1],
			lp = poly.pts[2];
		let ptInfo = [];
		let hasDisc = false;
		for(let testP of [np, lp]){
			let newPtInfo = {
				discontinuous:false,
				edges:[],
				pt:testP
			};
			if(xyzDist(p,testP) > defaultXYZLength*2){
				// check for discontinuity
				let edge1 = findParametricEdge(p, testP, x => xyzDist(p, x) < xyzDist(testP, x), xFunc, yFunc, zFunc, 20),
					edge2 = findParametricEdge(testP, p, x => xyzDist(p, x) > xyzDist(testP, x), xFunc, yFunc, zFunc, 20);
				edge1.deriv1 = safeDeriv(edge1, xFunc, yFunc, zFunc);
				edge2.deriv1 = safeDeriv(edge2, xFunc, yFunc, zFunc);
				if(xyzDist(edge1, edge2) > defaultXYZLength){
					hasDisc = true;
					newPtInfo.discontinuous = true;
					newPtInfo.edges.push(edge1, edge2);
				}
			}
			ptInfo.push(newPtInfo);
		}
		
		if(hasDisc){
			let discPts = ptInfo.filter(x => x.discontinuous);
			if(discPts.length === 2){
				discPolysToAdd.push({
					pts:[p, discPts[0].edges[0], discPts[1].edges[0]]
				});
				discPolysToAdd.push({
					pts:[discPts[0].pt, discPts[1].pt, discPts[0].edges[1]]
				});
				discPolysToAdd.push({
					pts:[discPts[0].pt, discPts[1].pt, discPts[1].edges[1]]
				});
			}else{
				// then only a single pt is
				let otherPt = discPts[0].pt === np ? lp : np;
				let newEdge = findParametricEdge(discPts[0].pt, otherPt, x => xyzDist(discPts[0].pt, x) < xyzDist(otherPt, x), xFunc, yFunc, zFunc, 20);
				newEdge.deriv1 = safeDeriv(newEdge, xFunc, yFunc, zFunc);
				let newEdge2 = findParametricEdge(otherPt, discPts[0].pt, x => xyzDist(otherPt, x) < xyzDist(discPts[0].pt, x), xFunc, yFunc, zFunc, 20);
				newEdge2.deriv1 = safeDeriv(newEdge2, xFunc, yFunc, zFunc);
				discPolysToAdd.push({
					pts:[discPts[0].pt, discPts[0].edges[1], newEdge]
				});
				discPolysToAdd.push({
					pts:[p, discPts[0].edges[0], otherPt]
				});
				discPolysToAdd.push({
					pts:[otherPt, p, newEdge2]
				});
			}
			polygons.splice(i, 1);
		}
	}
	for(let poly of discPolysToAdd){
		polygons.push(poly);
	}
	
	onFinish();
}

function makeNodeDist(base, pt, nodeDist, dir, xFunc, yFunc, zFunc){
	// the goal is to make the distance between pt and base within 10% of nodeDist 
	// if it already meets these standards, have a nice day
	let withinTolerance = (proposed) => Math.abs(xyzDist(base, proposed) - nodeDist) / nodeDist < .1;
	let gaveUp = false;
	pt.nodeDist = nodeDist;
	if(withinTolerance(pt)){
		pt.discontinuous = false;
		return pt;
	}else{
		// unfortunately, although we'd like to believe that as dir increases, xyzDist also increases,
		// this can be proved false in certain cercumstances. Thus, we really need to start at 0
		let a = 0;
		let delta = .2;
		let deltaMultiplier = 1;
		let count = 0;
		let switched = false;
		let original = xyzDist(base, pt);
		
		// for actual discontinuities, there needs to be a minimum u/v travel so we don't get stuck
		// (also, floating point errors)
		let minUVTravel = nodeDist / 10;
		
		while(!withinTolerance(pt)){
			count++;
			pt = plot(xFunc, yFunc, zFunc, base.u + a * dir.u, base.v + a * dir.v);
			let dist = xyzDist(pt, base);
			//console.log(original, dist, a);
			if(dist < nodeDist && deltaMultiplier < 0 || dist > nodeDist && deltaMultiplier > 0){
				deltaMultiplier *= -1;
				delta *= .2;
				switched = true;
				//console.log(original, 'switch');
			}
			a += delta * deltaMultiplier;
			
			while(Math.sqrt((a*dir.u)**2 + (a*dir.v)**2) < minUVTravel){
				a += Math.abs(delta * deltaMultiplier);
			}
			
			if(count > 15 && switched === false){
				deltaMultiplier *= 100;
				switched = true;
			}
			
			if(count > 30){
				// give up, we can't win
				gaveUp = true;
				break;
			}
		}
		let finalPt = plotPlus(xFunc, yFunc, zFunc, pt.u, pt.v);
		finalPt.discontinuous = gaveUp;
		return finalPt;
	}

	
}

function isEntirelyInvalid(pts){
	let invalid = true;
	for(let p of pts){
		if(p.real && !p.outsideDomain && !p.infinite){
			invalid = false;
		}
	}
	return false;
	return invalid;
}

function normal(pt){
	return cross(pt.deriv1.du, pt.deriv1.dv);
}

function withinPolygon(pt, poly){
	return withinPolygonCrossCount(pt,poly) % 2 === 1;
}

function withinPolygonCrossCount(pt, poly){
	// check if newPt is on the interior of pointFront. If so, remove the point.
	// we'll make use of a simple scanline algorithm for if a point is in a polygon
	const v0 = pt.v, u0 = pt.u;
	let crossCount = 0;
	for(const testPt of poly){
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
	
	return crossCount;
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

// finds curvature per unit (xyz) vector (uDir, vDir)
function dAngle(pt, uDir, vDir, xFunc, yFunc, zFunc){
	const delta = Math.min((domain.u.max-domain.u.min)/1e6, (domain.v.max-domain.v.min)/1e6);
	const pt2 = plotPlus(xFunc, yFunc, zFunc, pt.u + uDir*delta, pt.v + vDir*delta);
	
	let ptVec = add(scalar(uDir, pt.deriv1.du), scalar(vDir, pt.deriv1.dv));
	let pt2Vec = add(scalar(uDir, pt2.deriv1.du), scalar(vDir, pt2.deriv1.dv));
	
	let length1 = magnitude(ptVec),
		length2 = magnitude(pt2Vec);
		
	if(length1 === 0 || length2 === 0){
		return 0;
	}
	
	ptVec = scalar(1/length1, ptVec);
	pt2Vec = scalar(1/length2, pt2Vec);
	
	// curviture is the change in unit tangent per unit length
	return magnitude(scalar(1/delta,sub(pt2Vec, ptVec)));
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
	
    pt1.neighbors.push({
        draw:true,
        pt:pt2,
    });
    pt2.neighbors.push({
        draw:false,
        pt:pt1,
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

// plot the point, computes its 1st partial derivatives (dx/du, dx/dv etc)
function plotPlus(xfunc, yfunc, zfunc, u,v,delta){
    if(!delta){
        delta = Math.min((domain.u.max-domain.u.min)/1e9, (domain.v.max-domain.v.min)/1e9);
    }
    const p1 = plot(xfunc, yfunc, zfunc, u, v);
    
    return {
        x:p1.x,
        y:p1.y,
        z:p1.z,
        u:p1.u,
        v:p1.v,
        neighbors:[],
        deriv1:safeDeriv(p1, xfunc, yfunc, zfunc),
		real:p1.real,
		infinite:p1.infinite,
		outsideDomain:p1.outsideDomain
    };
}

// if there is a discontinuity on one side (within delta), picks the less large derivative
function safeDeriv(p1, xfunc, yfunc, zfunc){
	let delta = Math.min((domain.u.max-domain.u.min)/1e9, (domain.v.max-domain.v.min)/1e9);
	let [u,v] = [p1.u, p1.v];
	
    const pu = plot(xfunc, yfunc, zfunc, u-delta, v);
    const pv = plot(xfunc, yfunc, zfunc, u, v-delta);
	const pu2 = plot(xfunc, yfunc, zfunc, u+delta, v);
    const pv2 = plot(xfunc, yfunc, zfunc, u, v+delta);
	
	
    const u1 = scalar(1/delta,sub(p1,pu));
	const v1 = scalar(1/delta, sub(p1, pv));
	const u2 = scalar(-1/delta,sub(p1,pu2));
	const v2 = scalar(-1/delta, sub(p1, pv2));
	
	return {
		du: magnitude(u1) > magnitude(u2) ? u2 : u1,
		dv: magnitude(v1) > magnitude(v2) ? v2 : v1
	}
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
		// you know, like the ones in mines...
		// except this one dies when the point is non real
		// (and yes, I realize the great opportunity for a pun, but I'm better than that...)
		let nonRealCanary = {
			real:true
		};
        
        if(domain.currentSystem.indexOf('parametric') !== -1){
            //the parametric body is stored in the cX function by convention
            cX.eval(scope)
            point = {
                u:u,
                v:v,
            };
            [0,1,2].forEach(i => 
                point[domain.expressionInfo.expression.vars[i]] = getRealPart(math.subset(scope.x, math.index(i)), nonRealCanary)
            );
            if(domain.currentSystem.indexOf('cylindrical') !== -1){
                point.x = point.rho * Math.cos(point.phi);
                point.y = point.rho * Math.sin(point.phi);
				point.z = point.height;
            }else if(domain.currentSystem.indexOf('spherical') !== -1){
                point.x = point.r * Math.cos(point.theta) * Math.cos(point.sphi);
                point.y = point.r * Math.sin(point.theta) * Math.cos(point.sphi);
                point.z = point.r * Math.sin(point.sphi);
            }
        }else{
            cX.eval(scope);
            cY.eval(scope);
            cZ.eval(scope);
            point = {
				u:u,
				v:v,
				x:getRealPart(scope.x, nonRealCanary),
				y:getRealPart(scope.y, nonRealCanary),
				z:getRealPart(scope.z, nonRealCanary)
			};
        }
		
        point.x = spreadCoord(point.x, domain.x.min, domain.x.max, domain.x.spread);
        point.y = spreadCoord(point.y, domain.y.min, domain.y.max, domain.y.spread);
        point.z = spreadCoord(point.z, domain.z.min, domain.z.max, domain.z.spread);
		
		point.outsideDomain = false;
		point.infinite = false;
		
		let tempBefore = {x:point.x,y:point.y,z:point.z};
		
		// in order to properly traverse past sections that are outside the domain, 
		// there needs to exist some mapping from outside the domain to the edge of the 
		// domain. So for y = 1/x, obviously we can't plot from -1 to 1, but if we 
		// bound y to [-10, 10], we've mapped (10, infinity) to 10  and (-10, -infinity) to -10. 
		// This makes an infinite length line into a finite length one
		// we can do the same thing in 3D, bounding each axis to [-min, +max]
		// however, this leads to large swaths of space where x > xmax && y > ymax
		// && z > zmax that all map to the same point. This makes transversing this region 
		// impossible due to the current derivative-based direction algorithm (dir(...)). 
		// Instead, we seek a mapping from every possible point (outside the 
		// domain) to a unique point within a finite distance of the domain edge. 
		
		// one method of doing this is a projection onto a sphere with a 'height' component
		// off the surface of the sphere based on the distance from the center of the domain
		
		// check if distance to center is less than dist to corner * 1.1
		let cornerDist = Math.sqrt((domain.x.max-domain.center.x)**2+(domain.y.max-domain.center.y)**2+(domain.z.max-domain.center.z)**2);
		let ptDist = xyzDist(domain.center, point);
		const cornerMultiplier = 1.2;
		if(ptDist > cornerDist * cornerMultiplier){
			let sphereRadius= cornerDist * cornerMultiplier;
			let normalizedCenterVec = scalar(1/sphereRadius, sub(point, domain.center));
			let oldHeight = magnitude(normalizedCenterVec);
			// see https://www.desmos.com/calculator/tuohw1zvuw
			let newHeight = 2*((Math.E**3+1)/(Math.E**3-1))*(1/(1+Math.E**(-3*oldHeight))-0.5);
			normalizedCenterVec = scalar(1/magnitude(normalizedCenterVec), normalizedCenterVec);
			let newPos = add(scalar(newHeight*sphereRadius, normalizedCenterVec), domain.center);
			point.x = newPos.x;
			point.y = newPos.y;
			point.z = newPos.z;
		}
		
		// make all the points outside of the **cubic** domain dissappear
		if( point.x > domain.x.max || point.x < domain.x.min || 
			point.y > domain.y.max || point.y < domain.y.min ||
				point.z > domain.z.max || point.z < domain.z.min){
			point.outsideDomain = true;
		}
		
		for(let attr of ['x','y','z']){
			if(!isFinite(point[attr])){
				point[attr] = domain[attr].max;
				point.infinite = true;
			}
		}
		
        point.neighbors = [];
		point.real = nonRealCanary.real;
        return point;
}

// this was originally designed to find the boundary between a real and non-real point, but 
// it works just as well with any criteria
function findParametricEdge(realP, nonRealP, testFunc, xFunc, yFunc, zFunc, iterations){
    //when we have completed the necessary amount of iterations,
    //  return the real end of the interval containing the boundary
    if(iterations === 0){
        return realP;
    }
    
    //find the midpoint of realP and nonRealP in terms of parameterized variables
    var u = (realP.u + nonRealP.u)/2;
    var v = (realP.v + nonRealP.v)/2;
    
    let inBetween = plotPlus(xFunc, yFunc, zFunc, u, v);
    
    //return new interval
    if(!testFunc(inBetween)){
        return findParametricEdge(realP, inBetween, testFunc, xFunc, yFunc, zFunc, iterations - 1);
    }else{
        return findParametricEdge(inBetween, nonRealP, testFunc, xFunc, yFunc, zFunc, iterations - 1);
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

function getRealPart(val, canary){
	if(val.im){
		canary.real = false;
		return val.re;
	}
    return val;
}


