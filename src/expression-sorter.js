//takes a latex-parser output expression (it is important that variables be enclosed in parentheses)
//returns the characterization of the expression, as:
//{
//  error: <error_message> | none
//  message: <ambiguity, etc message>
//  type: cartesian | cylindrical | spherical,
//  parametric: true | false,
//  expression: <{vars:[__, ...  __, __,], body:__}>
//}
function characterizeExpression(expr){
    //latex-parser encloses multi-character variable names in 2 parentheses...
    expr = expr.replace(/\(\(phi\)\)/g,'(phi)');
    expr = expr.replace(/\(\(theta\)\)/g,'(theta)');
    expr = expr.replace(/\(\(rho\)\)/g,'(rho)');
    var vars = ['(x)','(y)','(z)','(r)','(phi)','(theta)','(rho)'];
    var varData = {
        cartesian:['(x)','(y)','(z)'],
        spherical:['(r)','(phi)','(theta)'],
        cylindrical:['(phi)','(rho)','(z)']
    }
    
    var structure = expr.trim().split('=');
    if(structure.length === 1){
        return {
            error: 'the equals sign is an important part of equations...'
        };
    }
    
    if(structure.length === 2){
        //a non-parametric expression must be in the form
        // var = expr
        // or
        // expr = var
        
        if(structure[0].length === 0 || structure[1].length === 0){
            return {
                error: 'there must be stuff on both sides of the equals sign'
            }
        }
        
        var varIndex = vars.indexOf(structure[0]);
        var varIndex2 = vars.indexOf(structure[1]);
        
        var varName = null, body = null;
        
        if(varIndex !== -1){
            varName = structure[0];
            body = structure[1];
        }
        if(varIndex2 !== -1){
            varName = structure[1];
            body = structure[0];
        }
        
        varName = varName ? varName.substring(1,varName.length-1) : varName
        
        if(varName && body){
            //we're looking at a non-parametric expression
            //the type of the variable and the type of the body (cartesian, cylindrical, spherical) should match
            //the body should not include the variable
            
            var type = exprType(expr, vars, varData);
            if(type.error !== 'none'){
                return type;
            }
            
            var containsVar = body.indexOf('('+varName+')') !== -1;
            if(containsVar){
                return {
                    error: varName.substring(1,varName.length-1)+' should not be present in the rest of your expression'
                }
            }else{
                if(type.type === 'ambiguous-z'){
                    return {
                        error:'none',
                        type:'cartesian',
                        message:'expression ambiguous -- chose cartesian system',
                        parametric:false,
                        expression:{vars:[varName], body:body}
                    };
                }
                if(type.type === 'ambiguous-phi'){
                    return {
                        error:'none',
                        type:'spherical',
                        message:'expression ambiguous -- chose spherical system',
                        parametric:false,
                        expression:{vars:[varName], body:body}
                    };
                }
                return {
                    error:'none',
                    type:type.type,
                    parametric:false,
                    expression:{vars:[varName], body: body}
                }
            }
        }else{
            //there are 2 forms of parametric functions:
            //(x,y,z) = ...
            //(x = ..., y = ..., z = ...)
            //since there's only 1 equals sign, this one must be the former
            
            var isAtomic = x => {
                var s = x.split(',');
                //correct format, and each element is included in vars
                return s.length === 3 && x.charAt(0) === '[' && x.charAt(x.length-1) === ']' &&
                    [s[0].substring(1,s[0].length), s[1], s[2].substring(0, s[2].length - 1)].map(a => vars.indexOf(a) !== -1).indexOf(false) === -1;
            }
            
            //requires isAtomic(x) === true
            var coordSys = x => {
                var s = x.split(',');
                //remove parentheses
                s[0] = s[0].substring(1,s[0].length);
                s[2] = s[2].substring(0,s[2].length-1);
                var cart = varData['cartesian'];
                var sphere = varData['spherical'];
                var cyl = varData['cylindrical'];
                //x contains all of the array sys
                var systemMatch = sys => sys.map(a => s.indexOf(a) !== -1).indexOf(false) === -1
                if(systemMatch(cart)){
                    return 'cartesian';
                }
                if(systemMatch(sphere)){
                    return 'spherical';
                }
                if(systemMatch(cyl)){
                    return 'cylindrical';
                }
                return 'none'
            }
            
            var head = null;
            var body = null;
            if(isAtomic(structure[0]) && coordSys(structure[0]) !== 'none'){
                head = structure[0];
                body = structure[1];
            }
            if(isAtomic(structure[1]) && coordSys(structure[1]) !== 'none'){
                head = structure[1];
                body = structure[0];
            }
            
            if(!head){
                if(isAtomic(structure[0]) || isAtomic(structure[1])){
                    return {
                        error:'make sure each system variable is present once for parametric expressions'
                    }
                }
                return {
                    error:'format error -- check out the acceptable forms in the help menu'   
                }
            }else{
                var present = arr => arr.map(x => body.indexOf(x) !== -1).indexOf(true) !== -1
                //filter is to remove overlap from lists (so z isn't called a cylindrical in cartesian)
                if( (coordSys(head) === 'cartesian' && present(varData['spherical'].concat(varData['cylindrical'].filter(x=>varData['cartesian'].indexOf(x)===-1)))) ||
                    (coordSys(head) === 'spherical' && present(varData['cartesian'].concat(varData['cylindrical'].filter(x=>varData['spherical'].indexOf(x)===-1)))) ||
                    (coordSys(head) === 'cylindrical' && present(varData['spherical'].concat(varData['cartesian'].filter(x=>varData['cylindrical'].indexOf(x)===-1)))) ){
                    return {
                        error:"don't mix coordinate system variables"
                    }
                }
                //if there's no u or v, there's no parametric function
                if(expr.indexOf('(u)') === -1 && expr.indexOf('(v)') === -1){
                    return {
                        error: 'parametric expressions require the presence of the variable u, v or most commonly both'
                    }
                }
                return {
                    error:'none',
                    type: coordSys(head),
                    parametric:true,
                    expression:{vars:head.substring(1,head.length-1).split(',').map(x => x.substring(1,x.length-1)), body:body}
                };
            }
        }
        
    }else{
        return {
            error: "malformed expression: not sure what you're doing with those equals signs"
        };
    }
}

function parseDomain(expr){
    expr = expr.replace(/\(\(phi\)\)/g,'(phi)');
    expr = expr.replace(/\(\(theta\)\)/g,'(theta)');
    expr = expr.replace(/\(\(rho\)\)/g,'(rho)');
    //acceptable forms:
    // x,y,z \in [a,b]
    // x,y \in [a,b], z \in [c,d]
    //in any combination
    var matches = expr.match(/((?:\([^\)\(]*?\),)*\([^\)\(]*?\))in(\[[^,]+?,[^,]+?\])/g);
    if(!matches){
        return {};
    }
    var varsAccountedFor = [];
    for(var k = 0; k < matches.length; k++){
        var m = matches[k];
        //so we can still have sin in expressions
        var segs = m.split('in[');
        var r = segs[1].split(',')
        var range = {
            min: r[0],
            max: r[1].substring(0,r[1].length-1)
        }
        var vars = segs[0].split(',').map(x => x.substring(1, x.length-1)).map(x => {return {varName:x, range:range}});
        varsAccountedFor = varsAccountedFor.concat(vars);
    }
    return varsAccountedFor;
}

//returns 
//{
//  error: none | <message>,
//  type: ambiguous-z | ambiguous-phi | cartesian | cylindrical | spherical
//}
function exprType(expr, vars, varData){
    //contains a variable in used && does not conain a variable in inverse of used
    var presentAndUnique = used => 
        used.map(elem => expr.indexOf(elem) !== -1).indexOf(true) !== -1 &&
        vars.filter(x => used.indexOf(x) === -1).map(elem => expr.indexOf(elem) !== -1).indexOf(true) === -1
    
    var isCartesian = presentAndUnique(varData['cartesian']);
    
    var isSpherical = presentAndUnique(varData['spherical']);
    
    if(presentAndUnique(varData['cylindrical'])){
        if(isCartesian || isSpherical){
            return {
                error:'none',
                type:'ambiguous-'+(isCartesian ? 'z' : 'phi')
            }
        }else{
            return {
                error:'none',
                type:'cylindrical'
            }
        }
    }else{
        if(isCartesian){
            return {
                error:'none',
                type: 'cartesian'
            }
        }else if(isSpherical){
            return {
                error:'none',
                type:'spherical'
            }
        }else{
            //it's none of the systems
            return {
                error:"don't mix coordinate system variables"
            }
        }
    }
    
    return {
        error: "Unknown error. If you're feeling nice, you could contact Alan Koval and tell him that his program sucks. Thanks!"
    }
}