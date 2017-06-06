//converts a latex expression into and expression evaluatable by math.js
var singleArgFuncs = {
    '\\\\sinh':'sinh',
    '\\\\sin':'sin',
    '\\\\cosh':'cosh',
    '\\\\cos':'cos',
    '\\\\tanh':'tanh',
    '\\\\tan':'tan',
    '\\\\atanh':'atanh',
    '\\\\atan2':'atan2',
    '\\\\atan':'atan',
    '\\\\asinh':'asinh',
    '\\\\asin':'asin',
    '\\\\acosh':'acosh',
    '\\\\acos':'acos',
    '\\\\ln':'log',
    '\\\\sqrt':'sqrt',
    '\\\\min':'min',
    '\\\\max':'max',
    '\\\\log':'log',
    '\\\\csch':'csch',
    '\\\\csc':'csc',
    '\\\\sech':'sech',
    '\\\\sec':'sec',
    '\\\\stirlingS2':'stirlingS2'
}
var thetaChar = 'Ì'
var phiChar = 'É'
var rhoChar = 'Î'
//order is important
var variables = [thetaChar,phiChar,rhoChar,'e','pi','x','y','z','r','u','v']
function parseLatex(expression, vars){
    variables = [thetaChar,phiChar,rhoChar,'e','pi','x','y','z','r','u','v']
    
    for(var j = 0; j < vars.length; j++){
        variables.push(vars[j].name)
    }
    
    expression = expression.replace(/\\theta/g, ' '+thetaChar);
    expression = expression.replace(/\\phi/g, ' '+phiChar);
    expression = expression.replace(/\\rho/g, ' '+rhoChar);
    expression = expression.replace(/\\pi/g, ' pi');
    //convert left and right parentheses to curly braces, as they should be
    expression = expression.replace(/\\left\(/g,'{');
    expression = expression.replace(/\\right\)/g,'}');
    expression = expression.replace(/\)/g,'}');
    expression = expression.replace(/\(/g,'{');
    expression = expression.replace(/\\left/g,'');
    expression = expression.replace(/\\right/g,'');
    
    //get rid of \operatorname{...} so that it can be a function (e.g. \operatorname{sech}(x) )
    var match;
    var regex;
    regex = /operatorname{/g;
    while((match=/operatorname{/g.exec(expression)) !== null){
        var index = match.index;
        //index of bracket
        var bIndex = index + 13;
        var endIndex = matchingRightChar('{','}',expression, bIndex);
        var middle = expression.substring(bIndex, endIndex);
        expression = expression.substring(0, index)+middle+' '+expression.substring(endIndex+1,expression.length);
    }
    
    //get rid of \text{...} so that it can be a function (e.g. \tex{exp})
    regex = /text{/g;
    while((match=regex.exec(expression)) !== null){
        index = match.index;
        //index of bracket
        bIndex = index + 5;
        endIndex = matchingRightChar('{','}',expression, bIndex);
        middle = expression.substring(bIndex, endIndex);
        expression = expression.substring(0, index)+middle+' '+expression.substring(endIndex+1,expression.length);
    }
    
    //enclose all variables in {} (for various reasons)
    for(var t = 0; t < variables.length; t++){
        var variable = variables[t];
        var reg = new RegExp(variable,'g');
        var varLocations = [];
        while((match = reg.exec(expression)) !== null){
            //if it can be extended to the left to a backslash, then it's not a variable
            //if it hits any non-letter before that, then it's a variable
            index = match.index;;
            var isVar = true;
            for(var subIndex = index; subIndex >= 0 ; subIndex--){
                var char = expression.charAt(subIndex);
                if(char.match(/\\/)){
                    isVar = false;
                    break;
                }
                if(char.match(/[^a-zA-Z]/)){
                    isVar = true;
                    break;
                }
            }
            if(isVar){
                varLocations.push(index);
            }
        }
        for(var u = varLocations.length - 1; u >=0 ; u--){
            var varIndex = varLocations[u];
            expression = expression.substring(0, varIndex)+'@'+variable+'?'+expression.substring(varIndex+variable.length,expression.length);
        }
    }
    
    expression = expression.replace(new RegExp('\('+thetaChar+'\)','g'), '(theta)');
    expression = expression.replace(new RegExp('\('+phiChar+'\)','g'), '(phi)');
    expression = expression.replace(new RegExp('\('+rhoChar+'\)','g'), '(rho)');
    
    //convert dot char to multiplication
    expression = expression.replace(/\\cdot/g,'*');
    
    //remove spaces
    expression = expression.replace(/ /g, '');
    
    //the more complicated functions, however, take a little bit more effort.
    //we will do them individually
    //absolute value
    var re;
    re = /\|/g;
    while((match=re.exec(expression)) !== null){
        index = match.index;
        for(var k = expression.length - 1; k > index; k--){
            if(expression.charAt(k) === '|'){
                var middle = expression.substring(index+1, k);
                expression = expression.substring(0,index)+'abs{'+middle+'}'
                    +expression.substring(k+1,expression.length);
                    break;
            }
        }
    }
    
    //for all the easy functions, we can just insert the correct function if there is 
    //parentheses, otherwise, it's a little more difficult
    for(var f in singleArgFuncs){
        re = new RegExp(f,'g');
        while((match=re.exec(expression)) !== null){
            var index = match.index;
            var nextChar = index + f.length - 1;

            if(expression.charAt(nextChar) === '{'){
                endIndex = matchingRightChar('{','}', expression, nextChar);
                expression = expression.substring(0, index)+singleArgFuncs[f]
                    +expression.substring(nextChar, expression.length)
            }else{
                //cut off at next non-multiplication or exponentation operation
                //examples: sin 2x^2 -> sin(2x^2)
                //(4+sin 2x)x -> (4+sin(2x))x
                //sin 4+x -> sin(4)+x
                //sin ln(x+4x-5) -> sin(ln(...))
                //sin ln x -> sin(ln(x))
                var goOn = true;
                var nextIndex = nextChar;
                var begIndex = nextChar;
                while(goOn){
                    var char = expression.charAt(nextIndex);
                    if(char === '{'){
                        nextIndex = matchingRightChar('{','}',expression, nextIndex)+1;
                        goOn = true;
                    }else if(char === '['){
                        nextIndex = matchingRightChar('[',']',expression ,nextIndex)+1;
                    }else if(char === '+' || char === '-' || char === '}' ||nextIndex === expression.length){
                        nextIndex--;
                        goOn = false;
                    }else{
                        goOn = true;
                        nextIndex++;
                    }
                }
                var endIndex = nextIndex;
                expression = expression.substring(0,index)+singleArgFuncs[f]+
                    '{'+expression.substring(nextChar,endIndex+1)+'}'+expression.substring(endIndex+1, expression.length);
            }
        }
    }
    
    //fractions
    re = /\\frac/g;
    while((match=re.exec(expression)) !== null){
        //5 for length of "\frac"
        var index = match.index + 5;
        var endIndex = matchingRightChar('{','}',expression,index);
        var index2 = endIndex + 1;
        var endIndex2 = matchingRightChar('{','}',expression,index2);
        var arg1 = expression.substring(index,endIndex+1);
        var arg2 = expression.substring(index2,endIndex2+1);
        expression = '{'+expression.substring(0,match.index) + arg1 + '/' + arg2 + expression.substring(endIndex2+1,expression.length)+'}';
    }
    
    //evaluate only the curly braces which are at the bottom of the chain
    //so they have no curly braces inside of them
    function curlyReplacer(match, innards){
        return '('+innards+')';
    }
    while(expression.match(/{([^\{\}]*)}/g)){
        expression = expression.replace(/{([^\{\}]*)}/g,curlyReplacer);
    }
    expression = expression.replace(/@/g,'(');
    expression = expression.replace(/\?/g,')')
    
    //really, we have the best chance of parsing if we omit backslashes
    expression = expression.replace(/\\/g,'');
    
    return expression;
}
//finds the matching } to a {. Returns the index of the matching }
//index is the index of the {. for braces, char = {, matchingChar = }
function matchingRightChar(char,matchingChar, exp, index){
    index++;
    var stack = 1;
    while(stack >= 1 && index<exp.length){
        if(exp.charAt(index) === matchingChar){
            stack--;
        }else if(exp.charAt(index) === char){
            stack++;
        }
        index++;
    }
    return index-1;
}

//does the same thing as matchingBrace, but proceeds left and finds matching { to compliment }
//index is index of }
function matchingLeftChar(char,matchingChar, exp, index){
    index--;
    var stack = 1;
    while(stack >= 1 && index >= 0){
        if(exp.charAt(index) === char){
            stack++;
        }else if(exp.charAt(index) === matchingChar){
            stack--;
        }
        index--;
    }
    return index+1;
}

//gets the next multiplication bounded chunk from expression, starting with the 
//char after index
function getNextChunk(expression, index, type){
    if(expression.charAt(index+1) === '{'){
        var nextIndex = matchingBrace(expression, index + 1);
        return expression.substring(index + 1, nextIndex + 1);
    }else if(type === 'pow'){
        //if there is more than 1 number, it will enclose it in curly braces
        return expression.charAt(index + 1);
    }else if(type === 'func'){
        //move over until there is a plus or minus 
    }
}

//same as getNextChunk, be goes to the left
//starts with previous char to index
function getPreviousChunk(expression, index, type){
    if(expression.charAt(index - 1) === '}'){
        var prevIndex = matchingBraceLeft(expression, index - 1);
        //also include function, if applicable
        for(var k = 0; k < singleArgFuncs.length; k++){
            var func = singleArgFuncs[k];
            if(expression.substring(prevIndex - func.length, prevIndex) === func){
                prevIndex = prevIndex - func.length;
            }
        }
        return expression.substring(prevIndex, index);
    }else if(type === 'pow'){
        //extend to last number or variable
        var lastDigit = expression.charAt(index-1)+'';
        var lastIndex = index - 1;
        //is it a variable?
        for(var k = 0; k < variables.length; k++){
            if(lastDigit === variables[k]){
                return lastDigit;
            }
        }
        //must be a number
        while(expression.charAt(lastIndex).match(/\d/)){
            lastIndex--;
        }
        return expression.substring(lastIndex+1, index)
    }
}