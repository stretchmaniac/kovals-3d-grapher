//(u,v) - point of divergence
//(du,dv) - direction of vector
function directionalDivergence(u,v,du,dv){
    
}

//returns {{dx/du, dx/dv},{dy/du, dy/dv},{dz/du, dz/dv}}
function dxyzduv(u,v){
    //du and dv are just examples right now, the actual value 
    //will depend on the min/max u and v values
    var du = .0001;
    var dv = .0001;
    var p1 = plot(u,v);
    var p2 = plot(u+du, v);
    var p3 = plot(u, v+dv);
    //this is a numeric derivative, so dx/du = delta x / delta u
    return [
        [(p2.x-p1.x)/du,(p3.x-p1.x)/dv],
        [(p2.y-p1.y)/du,(p3.y-p1.y)/dv],
        [(p2.z-p1.z)/du,(p3.z-p1.z)/dv]
    ]
}

var polygons = [];

function triangleInit(){
    //we will proceed across the surface, from u = uMin to u = uMax
    //   there will be a hundred or so "trails," going at various v coordinates
    //   when a trail meets a surface, the surface extends an amount greater than du,
    //   and so absorbs any trails that will meet it in the next cycle. When the surface
    //   ends, the trail will continue again in the "horizontal" direction, awaiting the 
    //   next surface.

    var trails = [];
    //DECIDE BASED ON DOMAIN
    var trailWidth;
    var trailEpsilon;
    var maxDivergence;
    
    var minU, maxU;
    
    //each surface is a list of absorbed trails, e.g. v values
    //  AND segments representing the frontier of the surface
    var surfaces = [];
    //this is the final product, the actual drawing polygons
    var polygons = [];
    //start trails @ u = uMin. Note that trails are NEVER taken out of 
    // the list (avoid looping problems), but simply labeled as "absorbed"
    for(var i = minU; i <= maxU; i += trailWidth){
        trails.push(
            {
                u:minU,
                v:i,
                absorbed:false
                
            });
    }
    
    //this is the frontier, the maxU for the iteration
    var globalU = minU;
    
    while(globalU <= maxU){
        //1. extend any surface to the next globalU, tranform trails as needed
        for(var k = 0; k < surfaces.length; k++){
            meshExtend(surfaces[k], globalU + trailEpsilon, polygons, maxDivergence, trails)
        }
        
        //2. check if any other trails are now real (e.g. turns into a new surface)
        //   IMPORTANT: any found surfaces are extended immediately
        for(var k = 0; k < trails.length; k++){
            //skip this one if it is currently in a surface
            if(trails[k].absorbed === false){continue;}
            
            var val = plot(trails[k].u,trails[k].v);
            //if this trail is now real
            if(!isNaN(val.x) && !isNaN(val.y) && isNaN(val.z) && val.x !== undefined && val.y !== undefined && val.z !== undefined){
                //create the new surface 
                var newSurface = {};
                newSurface.trails = [];
                newSurface.segments = [];
                newSurface.seed = {u: trails[k].u, v: trails[k].v};
                newSurface.trails.push(trails[k]);
                
                trails[k].absorbed = true;
                
                meshExtend(newSurface, globalU + trailEpsilon, polygons, maxDivergence, trails);
                
                surfaces.push(newSurface);
            }
        }
        
        //3. move any remaining trails to new globalU
        for(var k = 0; k < trails.length; k++){
            trails[k].u += trailEpsilon;
        }
        globalU += trailEpsilon;
    }
    
}

//tasks:
// 1. fill in all surface < maxU, bounded by nonreal points
// 2. absorb any trails caused by surface extension
// 3. if a surface consists of a single point, extend it in the u direction and 
//    work from there
function meshExtend(surface, maxU, polygons, maxDivergence, trails){
    var segments = surface.segments;
    //these are the segments that are beyond maxU, waiting for the next iteration
    var futureSegments = [];
    
    if(segments.length === 0){
        //task 3
        var direction = {u:1,v:0}
        var pt = surface.seed;
        var newPt = segExtend(pt, direction, maxDivergence);
        var nSeg = {p1: pt, p2: newPt};
        
        nSeg.cartP1 = plot(nSeg.p1);
        nSeg.cartP2 = plot(nSeg.p2);
        
        nSeg.normal = normal(nSeg, {u:0,v:1});
        //this is to indicate that the segment should be extended 
        //   on both sides – bidirectionality
        nSeg.seed = true;
        nSeg.active = true;
        
        segments.push(nSeg)
    }
    
    //each segment has 2 points and a normal (unit) vector representing 'out'
    while(segments.length > 0){
        for(var i = segments.length - 1; i >= 0 ; i--){
            //vector operations are in the uv coordinate system, NOT cartesian xyz
            var seg = segments[i];
            
            //segments that are beyond maxU should be shifted to next iteration
            if(seg.pt1.u > maxU && seg.p2.u > maxU){
                segments.splice(i,1);
                futureSegments.push(seg);
                continue;
            }
            
            //delete if inactive
            if(seg.active === false){
                segments.splice(i,1);
                continue;
            }
            
            var center = mid(seg.p1,seg.p2);
            var norm = seg.normal;
            
            snapWrapper(seg, center, norm, segments, maxDivergence)
            
            //repeat process on other side if this segment is a seed segment
            if(seg.seed){
                snapWrapper(seg, center, scale(-1,norm), segments, maxDivergence);
            }
        }
    }
    surface.segments = futureSegments;
}

function snapWrapper(seg,center,norm,segments,maxDivergence){
    var newPoint = segExtend(center, norm, maxDivergence)
    //its cartesian coordinates
    newPoint.cartP = plot(newPoint.u, newPoint.v);
            
    var snapInfo = snapTo(center, newPoint, segments);
    newPoint = snapInfo.resultPt;
    
    //create the new segment(s)
    for(var k = 0; k < snapInfo.baseConnections.length; k++){
        var newSeg = {p1: snapInfo.baseConnections[k], p2: newPoint};
        newSeg.normal = normal(newSeg, seg);
        segments.push(newSeg);
    }
}

//extends a unit vector (direction) a distance such that the 
//   divergence across that line is equal to maxDivergence
//IMPORTANT: direction is a (uv) unit vector
function segExtend(pt,direction,maxDivergence){
    var div = directionalDivergence(pt.u, pt.v, direction.u, direction.v);
    //the divergence is based on uv increases, so the "length" is correct in 
    //that it is the length moved along the u/v vectors to produce a cartesian 
    //divergence of the specified amount
    var length = maxDivergence / div; 
    var newPoint = add(pt, scale(length,direction));
    return newPoint;
}

//determined whether a point should be moved to fill in gaps
//returns some info with pt:
//  1. pt.snapped - if the point was snapped to another point
//  2. pt.baseConnections - what, if any, does the point now need to 
//     be connected to in order to form a new segment. Note that this 
//     excludes edges of surfaces
function snapTo(base, pt, segments){
    //rules:
    //1. if pt is close enough to another segment (.25 times its own length, cartesian), then connect to 
    //   the pt to the open end of that segment. Note that "close" is defined in cartesian coordinates
    //      In this case, stop propagation of the cuttoff segment(s) (the sements coming off 
    //      of the snapped to segment. There may be more than one). Note that this leaves
    //      open the possibility that other interior segments will remain active
    //2. if pt is undefined, then do a binary search to find the edge of the surface. 
    //      mark newPt.edge as true
    //3. if pt.edge === true and snappedPoint.edge === true, then the resulting segment is inactive
    for(var k = 0; k < segments.length; k++){
        var seg = segments[k];
        var v1 = sub(pt,seg.p1);
        var v2 = sub(pt, seg.p2);
        var ptToBase = sub(pt, base)
        if(dot(v1,v1) / dot(ptToBase,ptToBase) < .25*.25){
            snapped(pt, base, seg, seg.p1);
            return;
        }else if(dot(v2,v2) / dot(ptToBase,ptToBase) < .25*.25){
            snapped(pt, base, seg, seg.p2);
            return;
        }
    }
}

function snapped(pt, base, segment, segmentPt){
    var allSegs = segmentPt.neighbors;
    
}

//in cartesian coordinates
function segmentLength(segment){
    var p1 = segment.cartP1;
    var p2 = segment.cartP2;
    return Math.sqrt((p1.x-p2.x)*(p1.x-p2.x) + (p1.y-p2.y)*(p1.y-p2.y) + (p1.z-p2.z)*(p1.z-p2.z));
}

//the normal vector is not necessarily normal in the sense it 
//is usually thought of. In a uv parameterization, the u and v 
//may not be perpendicular to each other, thus the "normal" vector 
///can get a little weird. 
//rootSegment: a segment connected to the segment, used to 
//   determine the correct direction for the normal vector
function normal(segment, rootSegment){
    //locally, a uv surface can be transformed:
    //x(u,v) = a u + b v
    //y(u,v) = c u + d v
    //z(u,v) = e u + f v
    //in this case, a vector (g,h) in uv coordinates
    //is cartesianlly perpendicular to a vector 
    //{1,-((a^2 g+c^2 g+e^2 g+a b h+c d h+e f h)/(a b g+c d g+e f g+b^2 h+d^2 h+f^2 h))}
    //in the event that the normal is undefined, there is no way to make a normal 
    //vector since the surface is degenerate (probably a line). Return a random (u,v) cordinate
    var uvVec = sub(segment.p2,segment.p1);
    var g = uvVec.u; 
    var h = uvVec.v;
    var mid = mid(segment.p1, segment.p2);
    //we can recover a and b with dx/du and dx/dv, respectively
    var der = dxyzduv(mid.u,mid.v);
    var a = der[0][0];
    var b = der[0][1];
    var c = der[0][2];
    var d = der[1][0];
    var e = der[1][1];
    var f = der[1][2];
    var normal = {
        u: 1, 
        v: -((a*a*g + c*c*g + e*e*g + a*b*h + c*d*h + e*f*h)
        /(a*b*g + c*d*g + e*f*g + b*b*h + d*d*h+f*f*h))
    };
    if(!normal.v || isNaN(normal.v) || normal.v == undefined){
        normal.v = 0;
    }
    normal = normalize(normal);
    if(dot(normal,sub(rootSegment.p1,rootSegment.p2)) > 0){
        return scale(-1, normal);
    }
    return normal;
}

function plot(u,v){
    
}

function normalize(a){
    var norm = Math.sqrt(a.u*a.u+a.v*a.v);
    return scale(1/norm,a);
}

function cartSub(a,b){
    return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};
}

function project(a,b){
    return scale(dot(a,b)/dot(b,b),b);
}

function sub(a,b){
    return add(a,scale(-1,b));
}

function dot(a,b){
    return a.u*b.u + a.v*b.v;
}

function scale(s,a){
    return {u:s*a.u,v:s*a.v};
}

function add(a,b){
    return {u:a.u+b.u,v:a.v+b.v};
}

function mid(a,b){
    return {u:(a.u+b.u)/2,v:(a.v+b.v)/2};
}

function val(u,v){
    
}