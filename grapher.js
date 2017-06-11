/*global MathQuill*/
/*global parseLatex*/
/*global math*/
/*global MathJax*/
/*global $*/
var domain = {
    x:{min:-10,max:10, spread:1},
    y:{min:-10,max:10, spread:1},
    z:{min:-10,max:10, spread:1},
    u:{min:-10, max:10},
    v:{min:-10, max:10},
    rho:{min:0, max:10},
    phi:{min:0, max:Math.PI*2},
    height:{min:-10, max:10},
    r:{min:0,max:10},
    theta:{min:0,max:Math.PI*2},
    sphi:{min:-Math.PI/2,max:Math.PI/2},
    density:60,
    coloring: true,
    showAxes: true,
    shallowSketch:true,
    percentCalculated:0,
    lightDirections:[{x:0,y:0,z:-1}],
    pointsOnly:false,
    pointWidthRatio:.005,
    animating:false,
    stopAnimating:true,
    showMeshWhileColoring:false,
    directionalLighting:true,
    perspective:true,
    backgroundColor:'dark',
    minHue:50,
    maxHue:170,
    opacity:1,
    fullscreen:false,
    maxDeltaSlope:0.3,
    maxRecursion:1,
    rowLength:null,
}

var compile = require('interval-arithmetic-eval');

var handleablePoints = 5000;
var xQuat = quatNorm({w:1,x:0,y:0,z:0});
var yQuat = quatNorm({w:1,x:0,y:0,z:0});
var totalQuat = {w:1,x:0,y:0,z:0};
var cleanDensity = 15;
var graphing = false;

var points = [];
var pointQuats = [];
//holds indeces to points
var polygons = [];
var MQ;
var translation = {x:0,y:0};
var translateConst = .001;
var onlyPlotNewPoints = false;
var pointsToPlot = 0;

var unitQuat = {w:0,x:1,y:0,z:0};

var animationVars = [];
var animationImgs = [];

//[xFunc,yFunc,zFunc]
var cartGallery = [
        ['','','5\\cos \\left(2\\sqrt{x^2+y^2}\\right)\\operatorname{sech}\\left(\\frac{\\sqrt{x^2+y^2}}{1.5}\\right)'],
        ['','','\\cos x+\\cos y'],
        ['\\sin \\left(\\tan \\left(\\frac{\\left(\\text{hypot}\\left(z,y\\right)\\right)}{5}\\right)\\right)', '',''],
        ['8\\operatorname{sech}\\left(\\frac{\\left(\\text{hypot}\\left(y,z\\right)\\right)}{4}\\right)-12\\operatorname{sech}\\left(\\frac{\\left(\\text{hypot}\\left(y-2,z-2\\right)\\right)}{2}\\right)','',''],
        ['','\\sqrt{81-z^2-x^2}',''],
        ['','','5\\frac{1}{1+e^y}+5\\frac{1}{1+e^x}-5'],
        ['','','\\left(\\cos x+\\cos y\\right)\\left(\\frac{5}{1+\\sqrt{x^2+y^2}}\\sin \\left(\\sqrt{x^2+y^2}\\right)\\right)']
    ];
var cylinFuncGallery = [
        ['\\sqrt{u^2+v^2}\\cos v','\\sin \\left(v\\right)+\\frac{\\cos \\left(5u\\right)}{5}','u'],
        ['4\\operatorname{sech}z','',''],
        ['\\frac{\\left(\\text{catalan}\\left(\\text{floor}\\left(\\text{abs}\\left(z\\right)+1\\right)\\right)\\right)}{5000}}{5000}','',''],
        ['','\\rho +z',''],
        ['','\\cos\\left(\\rho\\right)+\\sin\\left(z\\right)',''],
        ['','3\\operatorname{sech}\\left(z\\right)\\left(\\cos \\left(\\rho\\right)+\\sin\\left(z\\right)\\right)',''],
        ['','','\\phi '],
        ['','','\\sin\\left(\\rho\\right)\\cos\\left(\\phi\\right)'],
        ['5+2\\cos \\left(v\\right)','u','2\\sin\\left(v\\right)'],
    ];
var sphereFuncGallery = [
        ['5\\left(1+2\\cos \\left(\\phi \\right)\\right)','',''],
        ['','r\\phi ',''],
        ['','r-\\phi ',''],
        ['','','\\frac{r\\theta }{4}'],
        ['v','\\sin\\left(3u\\right)','\\frac{uv}{4}'],
        ['2\\left(u-\\pi \\right)','\\sin \\left(2u\\right)','\\cos \\left(v\\right)']
    ];
    
var graphingError = false;

var axes = [
    [{w:0,x:1,y:0,z:0},{w:0,x:-1,y:0,z:0},{w:0,x:1,y:0,z:0},{w:0,x:-1,y:0,z:0}],
    [{w:0,x:0,y:1,z:0},{w:0,x:0,y:-1,z:0},{w:0,x:0,y:1,z:0},{w:0,x:0,y:-1,z:0}],
    [{w:0,x:0,y:0,z:1},{w:0,x:0,y:0,z:-1},{w:0,x:0,y:0,z:1},{w:0,x:0,y:0,z:-1}]
    ];

$(function(){
    var width = $('#content-graph').width();
    var height = $('#content-graph').height();
    $("#canvas").prop('width',width)
    $('#canvas').prop('height',height)
    
    $('#u-v-range-row').hide();
    
    $('#plot-table').editableTableWidget({
	    cloneProperties: ['background', 'border', 'outline','padding','text-align','font-size'],
	    editor:$('<textarea>')
    })
    
    var onNotLastChanged =  function(evt2, newValue2){
        var cols = $(this).children($('td'));
        var empty = true;
        for(var k = 0; k < cols.length; k++){
            if(cols[k].textContent.trim().length > 0){
                empty = false;
            }
        }
        if(empty){
            var nextElement = $(this).next('tr');
            var active = $(evt2.target);
            var col = $(this).children().index(active);
            $(this).remove();
            if(nextElement[0]){nextElement.children('td')[col].focus();}
        }
    };
    
    var onLastChanged = function(evt, newValue){
        $(this).off('validate');
        if(newValue.trim().length > 0){
            $('#plot-table-body').append("<tr><td></td><td></td><td></td></tr>")
        }
        $('#plot-table').editableTableWidget({
    	    cloneProperties: ['background', 'border', 'outline','padding','text-align','font-size'],
    	    editor:$('<textarea>')
        });
        $('#plot-table tr:last').on('validate', arguments.callee);
        
        $('#plot-table tr:not(:last)').on('change', onNotLastChanged);
    }
    
    $('#plot-table tr:last').on('validate', onLastChanged);
    
    $('#plot-table tr:not(:last)').on('change', onNotLastChanged);
    
    $('#plot-table td').on('validate',function(evt, newValue){
        $(this).off('validate');
        var td = evt.target;
        var rows = newValue.split('\n');
        var rowElement = $(this).parent();
        var tableBody = rowElement.parent();
        var row = tableBody.children('tr').index(rowElement);
        var col = rowElement.children().index(td);
        var multipleElements = false;
        if(rows.length > 1){
            multipleElements = true;
        }
        for(var r = 0 ; r < rows.length; r++){
            var cols = rows[r].split('\t');
            if(cols.length > 1){
                multipleElements = true;
                var newRow;
                var addedRow = false;
                if(tableBody.children('tr')[r+row]){
                    newRow = $(tableBody.children('tr')[r+row]);
                }else{
                    $('#plot-table-body').append("<tr><td></td><td></td><td></td></tr>");
                    newRow = $('#plot-table-body').children('tr').last();
                    addedRow = true;
                }
                var newTds = newRow.children('td');
                var currentCol = col;
                while(currentCol <= 2 && currentCol-col < cols.length){
                    newTds[currentCol].textContent = cols[currentCol-col];
                    currentCol++;
                }
            }
        }
        if(multipleElements){
            td.textContent = rows[0].split('\t')[0];
            $('#plot-table + textarea').val(td.textContent)
            
            $('#plot-table').editableTableWidget({
        	    cloneProperties: ['background', 'border', 'outline','padding','text-align','font-size'],
        	    editor:$('<textarea>')
            });
            
            $('#plot-table tr:last').on('validate', onLastChanged);
            $('#plot-table tr:not(:last)').on('change', onNotLastChanged);
            
            if(addedRow){
                onLastChanged(evt, newValue);
            }
        }
        $('#plot-table td').on('validate',arguments.callee);
    })
    
    $('#rho-phi-height-range-row').hide();
    $('#cylindrical-coordinates').hide();
    
    $('#r-theta-sphi-range-row').hide();
    $('#spherical-coordinates').hide();
    
    $('#help').click(function(){
        $('#help-popup').removeClass('hidden');
        $(document).mouseup(function (e){
            var container = $("#help-content");
            if (!container.is(e.target) && container.has(e.target).length === 0){
                $('#help-popup').addClass('hidden');
                $("#help-content").unbind( 'click', document);
            }
        });
    })
    $('#help-popup').click(function(event){
        
    })
    $('#export-button').click(function(){
        $('#export-popup').removeClass('hidden');
        setUpDownload();
        $(document).mouseup(function (e){
            var container = $("#export-content");
            if (!container.is(e.target) && container.has(e.target).length === 0){
                $('#export-popup').addClass('hidden');
                $("#export-content").unbind( 'click', document);
            }
        });
    })
    $('#export-cancel-button').click(function(){
        $('#export-popup').addClass('hidden');
        $("#export-content").unbind('click', document);
    })
    $('#export-save-button').click(function(){
        $('#export-popup').addClass('hidden');
        $("#export-content").unbind('click', document);
    })
    $('#export-popup').click(function(event){
        
    })
    $('#animate-button').click(function(event){
        $('#animate-popup').removeClass('hidden');
        $(document).mousedown(function (e){
            var container = $("#animate-content");
            if (!container.is(e.target) && container.has(e.target).length === 0){
                $('#animate-popup').addClass('hidden');
                $("#animate-content").unbind( 'click', document);
            }
        });
    })
    $('#animate-start-button').click(function(){
        animate();
    })
    
    $('#add-variable-button').click(function(){
        //create new row
        var newRow = $('.variable-list-item').last().clone();
        newRow.find('.var-name-input').val('');
        newRow.find('.var-lower-bound-input').val('');
        newRow.find('.var-upper-bound-input').val('');
        newRow.find('.variable-remove-button').click(function(event){
            if($('.variable-list-item').length > 1){
                removeVariable(event.target);
            }
        })
        newRow.insertBefore($('#add-variable-button'));
    });
    
    $('.variable-remove-button').click(function(event){
        if($('.variable-list-item').length > 1){
            removeVariable(event.target);
        }
    })
    
    MQ = MathQuill.getInterface(2);
    var xInput = document.getElementById('x-input');
    var yInput = document.getElementById('y-input');
    var zInput = document.getElementById('z-input');
    var rhoInput = document.getElementById('rho-input');
    var phiInput = document.getElementById('phi-input');
    var heightInput = document.getElementById('height-input');
    var sphiInput = document.getElementById('sphi-input');
    var rInput = document.getElementById('r-input');
    var thetaInput = document.getElementById('theta-input');
    var autoCommands = 'pi theta rho phi sqrt sum';
    var inputs = [xInput, yInput, zInput, phiInput, heightInput, rhoInput, sphiInput, thetaInput, rInput];
    for(var r = 0; r < inputs.length; r++){
        (function(){
            MQ.MathField(inputs[r],{
                spaceBehavesLikeTab: true,
                sumStartsWithNEquals: true,
                supSubsRequireOperand: true,
                autoCommands: autoCommands,
                handlers:{
                    enter:function(mathField){
                        $('#graph-button').click();
                    }
                }
            });
        })();
    }
    
    var xMin = document.getElementById('x-range-min-input');
    var yMin = document.getElementById('y-range-min-input');
    var zMin = document.getElementById('z-range-min-input');
    var xMax = document.getElementById('x-range-max-input');
    var yMax = document.getElementById('y-range-max-input');
    var zMax = document.getElementById('z-range-max-input');
    
    var rhoMin = document.getElementById('rho-range-min-input');
    var phiMin = document.getElementById('phi-range-min-input');
    var heightMin = document.getElementById('height-range-min-input');
    var rhoMax = document.getElementById('rho-range-max-input');
    var phiMax = document.getElementById('phi-range-max-input');
    var heightMax = document.getElementById('height-range-max-input');
    
    var rMin = document.getElementById('r-range-min-input');
    var thetaMin = document.getElementById('theta-range-min-input');
    var sphiMin = document.getElementById('sphi-range-min-input');
    var rMax = document.getElementById('r-range-max-input');
    var thetaMax = document.getElementById('theta-range-max-input');
    var sphiMax = document.getElementById('sphi-range-max-input');
    
    var uMin = document.getElementById('u-range-min-input');
    var uMax = document.getElementById('u-range-max-input');
    var vMin = document.getElementById('v-range-min-input');
    var vMax = document.getElementById('v-range-max-input');
    
    autoCommands = 'pi sqrt'
    var domainInputs = [xMin,yMin,zMin,xMax,yMax,zMax,rhoMin,phiMin,heightMin,rhoMax,phiMax,heightMax,rMin,thetaMin,sphiMin,rMax,thetaMax,sphiMax,uMin,uMax,vMin,vMax];
    for(var w = 0; w < domainInputs.length; w++){
        (function(){
            MQ.MathField(domainInputs[w],{
                supSubsRequireOperand: true,
                autoCommands: autoCommands
            })
        })();
    }
    
    
    syncAxes()
    
    //Math.sqrt(45-x*x-y*y)+Math.cos(Math.sqrt(10*(x*x+y*y)))
    //Math.floor(x/5)+Math.floor(y/5)
    //Math.tan(x)
    //Math.sin(x)+Math.sin(y)
    //randomGraph();
    setTimeout(function(){
        var xInput = MQ.MathField(document.getElementById('x-input'));
        var yInput = MQ.MathField(document.getElementById('y-input'));
        var zInput = MQ.MathField(document.getElementById('z-input'));
        var rhoInput = MQ.MathField(document.getElementById('rho-input'));
        var phiInput = MQ.MathField(document.getElementById('phi-input'));
        var heightInput= MQ.MathField(document.getElementById('height-input'));
        var rInput = MQ.MathField(document.getElementById('r-input'))
        var thetaInput = MQ.MathField(document.getElementById('theta-input'))
        var sphiInput = MQ.MathField(document.getElementById('sphi-input'))
        var inputs = [xInput, yInput, zInput, rhoInput, phiInput, heightInput, rInput, thetaInput, sphiInput];
        for(var a = 0; a < inputs.length; a++){
            var input = inputs[a];
            input.cmd(')');
            input.keystroke('Backspace')
            input.blur();
        }
    },500)
    domain.coloring = true;
    document.getElementById('color-checkbox').checked = true;
    totalQuat = {w: 0.7946319801955918, x: 0.04116688544469564, y: -0.5886375904216452, z: -0.14272733002412488}
    graph();
    
    var mouseClicked = false;
    var leftMouseClicked = false;
    var mousePosition = {x:0,y:0};
    $('#canvas').mousemove(function(event){
        var deltaX,deltaY;
        if(!leftMouseClicked && mouseClicked){
            deltaX = event.clientX - mousePosition.x;
            deltaY = event.clientY - mousePosition.y;
            
            xQuat.y = -deltaX / 500;
            yQuat.x = deltaY / 500;
            
            quatNorm(xQuat);
            quatNorm(yQuat);
            
            rotatePoints(pointQuats,yQuat)
            rotatePoints(pointQuats,xQuat)
            
            totalQuat = quatMult(quatMult(xQuat,yQuat),totalQuat);
            
            quatNorm(totalQuat)
            
            rotatePoints(axes[0], yQuat);
            rotatePoints(axes[1], yQuat);
            rotatePoints(axes[2], yQuat);
            rotatePoints(axes[0], xQuat);
            rotatePoints(axes[1], xQuat);
            rotatePoints(axes[2], xQuat);
            
            plotPoints()
        }
        if(leftMouseClicked){
            if(!domain.panCenter){
                domain.panCenter = {x: domain.center.x, y: domain.center.y, z: domain.center.z};
            }
            deltaY = event.clientX - mousePosition.x;
            deltaX = event.clientY - mousePosition.y;
            
            //figure out what direction we should change the domain
            var px = pointToQuat({x:-1,y:0,z:0});
            var py = pointToQuat({x:0,y:-1,z:0});
            rotate(px, quatConj(totalQuat), {x:0,y:0,z:0});
            rotate(py, quatConj(totalQuat), {x:0,y:0,z:0});
            
            //now we need to know the magnitude of the change
            var xWidth = (domain.x.max - domain.x.min);
            var yWidth = (domain.y.max - domain.y.min);
            var zWidth = (domain.z.max - domain.z.min);
            
            px.x *= (xWidth * translateConst);
            px.y *= (yWidth * translateConst);
            px.z *= (zWidth * translateConst)
            
            px = quatScalar(px, deltaX);
            
            py.x *= (xWidth * translateConst);
            py.y *= (yWidth * translateConst);
            py.z *= (zWidth * translateConst);
            
            py = quatScalar(py, deltaY);
            
            domain.center.x += (px.x + py.x);
            domain.center.y += (px.y + py.y);
            domain.center.z += (px.z + py.z);
            
            domain.x.min = domain.center.x - xWidth/2;
            domain.x.max = domain.center.x + xWidth/2;
            domain.y.min = domain.center.y - yWidth/2;
            domain.y.max = domain.center.y + yWidth/2;
            domain.z.min = domain.center.z - zWidth/2;
            domain.z.max = domain.center.z + zWidth/2;
            
            changeDomainInputs()
            
            syncAxes();
            
            syncQuats()
    
            plotPoints()
        }
        mousePosition = {x:event.clientX,y:event.clientY};
    })
    $('#canvas').mousedown(function(event){
        mouseClicked = false;
        leftMouseClicked = false;
        if(event.which === 1){
            mouseClicked = true;
        }else if(event.which === 3){
            //leftMouseClicked = true;
        }
        mousePosition = {x:event.clientX,y:event.clientY};
        if(domain.coloring && domain.coloringTime && domain.coloringTime > 100){
            domain.wasColoring = true;
            domain.coloring = false;
        }else{
            domain.wasColoring = false;
        }
    })
    $('#canvas').mouseup(function(e){
        mouseClicked = false;
        if(leftMouseClicked){
            skipDomain = true;
            graph();
            skipDomain = false;
            domain.panCenter = null;
        }
        if(domain.wasColoring){
            domain.coloring = true;
        }
        plotPoints()
        leftMouseClicked = false;
    })
    var timeID;
    $('#canvas').bind('mousewheel', function(e){
        var magnification = 1;
        if(e.originalEvent.wheelDelta > 0){
            magnification = .9;
        }else{
            magnification = 1/.9;
        }
        var c = getRealDomainCenter()
        var w = getRealDomainWidth();
        var prevDomain = domain;
        var min = c.x-w.x/2;
        var max = c.x+w.x/2;
        domain.x.min = spreadCoord(min, min, max, magnification*domain.x.spread);
        domain.x.max = spreadCoord(max, min, max, magnification*domain.x.spread);
        min = c.y-w.y/2;
        max = c.y+w.y/2;
        domain.y.min = spreadCoord(min, min, max, magnification*domain.y.spread);
        domain.y.max = spreadCoord(max, min, max, magnification*domain.y.spread);
        min = c.z-w.z/2;
        max = c.z+w.z/2;
        domain.z.min = spreadCoord(min, min, max, magnification*domain.z.spread);
        domain.z.max = spreadCoord(max, min, max, magnification*domain.z.spread);
        
        if(cartesian){
        }else if(spherical){
            domain.r.min *= magnification;
            domain.r.max *= magnification;
        }else if(cylindrical){
            domain.rho.min *= magnification;
            domain.rho.max *= magnification;
            min = domain.height.min;
            max = domain.height.max;
            domain.height.min = spreadCoord(min, min, max, magnification);
            domain.height.max = spreadCoord(max, min, max, magnification);
        }
        
        syncAxes()
        
        if(timeID){
            clearTimeout(timeID);
        }
        if(domain.coloringTime && domain.coloringTime > 100 && domain.coloring){
            domain.wasColoring = true;
            domain.coloring = false;
        }
        plotPoints()
        if(domain.wasColoring){
            domain.coloring = true;
        }
        timeID = setTimeout(function(){
            changeDomainInputs()
            skipDomain = true;
            graph();
            skipDomain = false;
        },500)
    })
    document.getElementById('canvas').oncontextmenu = function(e){
        return false;
    }
});

$(window).resize(function(){
    var width = $('#content-graph').width();
    var height = $('#content-graph').height();
    if(!domain.fullscreen){
        $("#canvas").prop('width',width)
        $('#canvas').prop('height',height)
    }else{
        $("#canvas").prop('width',$(window).width())
        $('#canvas').prop('height',$(window).height())
    }    
    plotPoints();
});

var cylindrical = false;
var spherical = false;
var cartesian = true;
var skipDomain = false;

var intervalId, intervalId2, intervalId3, intervalId4, intervalId5;
var intervalFunctionSupported = true;

$('#cartesian-button').click(function(){
    cartesian = true;
    cylindrical = false;
    spherical = false;
    $('densisty')
    $('#rho-phi-height-range-row').hide();
    $('#r-theta-sphi-range-row').hide();
    $('#spherical-coordinates').hide();
    $('#cylindrical-coordinates').hide();
    $('#cartesian-coordinates').show();
    $('#x-y-z-range-row').show();
    if(isParametric()){
        $('#u-v-range-row').show();
    }else{
        $('#u-v-range-row').hide();
    }
    $('#x-plot-heading').html('\\(x\\)');
    $('#y-plot-heading').html('\\(y\\)');
    $('#z-plot-heading').html('\\(z\\)');
    refreshMathJax()
    
    if(domain.pointsOnly){
        $('#plot-row').show();
        $('#cartesian-coordinates').hide();
        $('#density-row').hide();
        $('#u-v-range-row').hide();
        $('#color-row').hide();
    }else{
        $('#plot-row').hide();
        $('#color-row').show();
        $('#density-row').show();
    }
});

$('#cylindrical-button').click(function(){
    cartesian = false;
    cylindrical = true;
    spherical = false;
    $('#cartesian-coordinates').hide();
    $('#x-y-z-range-row').hide();
    $('#spherical-coordinates').hide();
    $('#r-theta-sphi-range-row').hide();
    $('#rho-phi-height-range-row').show();
    $('#cylindrical-coordinates').show();
    if(isCylindricalParametric()){
        $('#u-v-range-row').show();
    }else{
        $('#u-v-range-row').hide();
    }
    $('#x-plot-heading').html('\\(\\rho\\)');
    $('#y-plot-heading').html('\\(\\phi\\)');
    $('#z-plot-heading').html('\\(z\\)');
    refreshMathJax();
    
    if(domain.pointsOnly){
        $('#plot-row').show();
        $('#cylindrical-coordinates').hide();
        $('#density-row').hide();
        $('#u-v-range-row').hide();
        $('#color-row').hide();
    }else{
        $('#plot-row').hide();
        $('#color-row').show();
        $('#density-row').show();
    }
})

$('#spherical-button').click(function(){
    cartesian = false;
    cylindrical = false;
    spherical = true;
    $('#cartesian-coordinates').hide();
    $('#x-y-z-range-row').hide();
    $('#cylindrical-coordinates').hide();
    $('#rho-phi-height-range-row').hide();
    $('#r-theta-sphi-range-row').show();
    $('#spherical-coordinates').show();
    if(isSphericalParametric()){
        $('#u-v-range-row').show();
    }else{
        $('#u-v-range-row').hide();
    }
    $('#x-plot-heading').html('\\(r\\)');
    $('#y-plot-heading').html('\\(\\theta\\)');
    $('#z-plot-heading').html('\\(\\phi\\)');
    refreshMathJax();
    
    if(domain.pointsOnly){
        $('#plot-row').show();
        $('#spherical-coordinates').hide();
        $('#density-row').hide();
        $('#u-v-range-row').hide();
        $('#color-row').hide();
    }else{
        $('#plot-row').hide();
        $('#color-row').show();
        $('#density-row').show();
    }
});

$('#plot-button').click(function(){
    domain.pointsOnly = !domain.pointsOnly;
    if(domain.pointsOnly){
        $('#plot-button').css('background-color','rgb(34, 149, 84)')
    }else{
       $('#plot-button').css('background-color','')
    }
    
    if(cartesian){
        $('#cartesian-button').click();
    }
    if(cylindrical){
        $('#cylindrical-button').click();
    }
    if(spherical){
        $('#spherical-button').click();
    }
});

$('#axes-checkbox').change(function(){
    if($('#axes-checkbox').prop('checked') === true){
        domain.showAxes = true;
    }else{
        domain.showAxes = false;
    }
    plotPoints()
})

$('#color-checkbox').change(function(){
    if($('#color-checkbox').prop('checked') === true){
        domain.coloring = true;
    }else{
        domain.coloring = false;
    }
    plotPoints()
})

$('#mesh-checkbox').change(function(){
    domain.showMeshWhileColoring = $('#mesh-checkbox').prop('checked');
    plotPoints();
})

$('#directional-lighting-checkbox').change(function(){
    domain.directionalLighting = $('#directional-lighting-checkbox').prop('checked');
    plotPoints();
})

$('#perspective-checkbox').change(function(){
    domain.perspective = $('#perspective-checkbox').prop('checked');
    plotPoints();
})

$('#color-scheme-select').change(function(){
    var value = $(this).val();
    if(value == 'dark-rust'){
        domain.backgroundColor = 'dark'
        domain.minHue = 0;
        domain.maxHue = 50;
    }
    if(value == 'light-rust'){
        domain.backgroundColor = 'light'
        domain.minHue = 0;
        domain.maxHue = 50;
    }
    if(value == 'light-cool'){
        domain.backgroundColor = 'light'
        domain.minHue = 150;
        domain.maxHue = 300;
    }
    if(value == 'dark-cool'){
        domain.backgroundColor = 'dark'
        domain.minHue = 150;
        domain.maxHue = 300;
    }
    if(value == 'dark-blue'){
        domain.backgroundColor = 'dark'
        domain.minHue = 50;
        domain.maxHue = 170;
    }
    if(value == 'light-blue'){
        domain.backgroundColor = 'light'
        domain.minHue = 50;
        domain.maxHue = 170;
    }
    plotPoints();
})

$('#full-screen-button').click(function(){
    var elem = document.getElementById('canvas');
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    }
    domain.fullscreen = true;
    
    function exitHandler(){
        if (document.webkitIsFullScreen || document.mozFullScreen || document.msFullscreenElement !== null){
            domain.fullscreen = false;
        }
    }
    
    if (document.addEventListener){
        document.addEventListener('webkitfullscreenchange', exitHandler, false);
        document.addEventListener('mozfullscreenchange', exitHandler, false);
        document.addEventListener('fullscreenchange', exitHandler, false);
        document.addEventListener('MSFullscreenChange', exitHandler, false);
    }
})

function animate(){
    //get actual animationVar list
    animationVars = [];
    var allRows = $('.variable-list-item');
    
    $('.animate-error-area').empty();
    
    var failure = false;
    
    allRows.each(function(){
        var name = $(this).find('.var-name-input').val();
        var low = parseFloat($(this).find('.var-lower-bound-input').val());
        var high = parseFloat($(this).find('.var-upper-bound-input').val());
        if(!isFinite(low) || !isFinite(high) || isNaN(low) || isNaN(high) || name.trim().length === 0 || low > high){
            $('.animate-error-area').append("<div style='color:red'>Error with variable <i>"+name+"</i>.</div>")
            failure = true;
        }
        animationVars.push({name:name, low: low, high:high});
    })
    
    var steps = parseFloat($('#animation-frame-input').val());
    if($('#animation-frame-input').val().length.trim === 0 || isNaN(steps)){
        $('.animate-error-area').append("<div style='color:red'>Please enter frame count.</div>")
        failure = true;
    }
    
    if(failure){
        return;
    }
    
    animationImgs = [];
    domain.animating = true;
    $('#animate-start-button').prop('disabled', true);
    for(var k = 0; k < animationVars.length; k++){
        var varObj = animationVars[k];
        varObj.value = varObj.low;
        varObj.step = (varObj.high - varObj.low) / steps * 1.000000000001; // so it doesn't go 1 over
    }
    
    $('#animation-progress-bar').show();
    $('#animation-progress-bar').prop('max', steps);
    
    var progress = 1;
    $('#animation-progress-bar').prop('value', progress);
    
    graph(function(){
        progress++;
        $('#animation-progress-bar').prop('value', progress);
        var finished = false;
        for(var j = 0; j < animationVars.length; j++){
            var varObj = animationVars[j];
            varObj.value += varObj.step;
            if(varObj.value >= varObj.high){
                finished = true;
            }
        }
        //save the canvas image
        var dataURL = document.getElementById('canvas').toDataURL('image/png');
        animationImgs.push(dataURL);
        
        if(finished === false){
            try{
                graph(arguments.callee);
            }catch(e){
                displayCanvasError();
                console.log(e.stack)
                finished = true;
                $('#animate-popup').addClass('hidden');
                $('#animate-start-button').prop('disabled', false);
                domain.animating = false;
            }
        }else{
            onAnimationFinish();
        }
    })
    
}

function onAnimationFinish(){
    $('#animate-start-button').prop('disabled', false);
    $('#animation-progress-bar').hide();
    //close popup
    $('#animate-popup').addClass('hidden');
    $("#animate-content").unbind( 'click', document);
    domain.animating = false;
    //load images
    for(var i = 0; i < animationImgs.length; i++){
        (function(){
            var u = i;
            var image = new Image();
            image.onload = function(){
                animationImgs[u] = image;
                if(u === animationImgs.length - 1){
                    $('#export-gif-progress-bar').hide();
                    $('#animation-result-export-button').show();
                    startAnimationPlayback();
                }
            }
            image.src = animationImgs[i];
        })();
    }
}

function startAnimationPlayback(){
    //show dialog
    $('#animation-result-popup').show();
    
    //now show animation on canvas
    var actualCanvas = document.getElementById('canvas');
    var canvas = document.getElementById('animation-canvas');
    canvas.height = actualCanvas.clientHeight;
    canvas.width = actualCanvas.clientWidth;
    
    var playStyle = 'loop';
    var deltaImgNum = 1;
    var waitTime = 50;
    var timerID;
    
    playStyle = $('input[type=radio][name=play-style]:checked').prop('value');
    
    $('input[type=radio][name=play-style]').change(function(){
        playStyle = this.value;
    })
    
    $('#animation-result-frame-time-input').on('input',function(){
        waitTime = parseFloat((101-this.value) * 5);
    })
    
    $('#animation-result-exit-button').click(function(){
        $('#animation-result-popup').hide();
        domain.stopAnimating = true;
        animationImgs = [];
    })
    
    var srcList = [];
    for(var k = 0; k < animationImgs.length; k++){
        srcList.push(animationImgs[k].src);
    }
    
    var capture = null;
    var progress = 1;
    
    $('#animation-result-export-button').click(function(){
        $('#animation-result-export-button').hide();
        $('#export-gif-progress-bar').show();
        progress = 1;
        capture = new CCapture({
            verbose:true, 
            framerate: 1000 / waitTime, 
            quality:1,
            name:'Graph',
            format: 'webm', 
            workersPath:'',
            progress:function(){
                var percent;
                if(playStyle === 'loop'){
                    percent = progress / srcList.length;
                }else{
                    percent = progress / (srcList.length * 2-1)
                }
                progress++;
                $('#export-gif-progress-bar').prop('value', percent);
                if(percent === 1){
                    $('#animation-result-export-button').show();
                    $('#export-gif-progress-bar').hide();
                }
            }
        });
        capture.start();
    });
    
    var ctx = canvas.getContext('2d')
    var imgNum = 0;
    domain.stopAnimating = false;
    var previouslyCapturing = false;
    
    var id = setTimeout(function(){
        if(domain.stopAnimating === false){
            var firstTime = false;
            if(previouslyCapturing === false && capture !== null){
                imgNum = 0;
                previouslyCapturing = true;
                firstTime = true;
            }
            
            if(capture !== null && imgNum === 0 && !firstTime){
                capture.stop();
                capture.save();
                capture = null;
                previouslyCapturing = false;
            }
            
            var image = animationImgs[imgNum];
            if(playStyle === 'loop'){
                imgNum++;
                if(imgNum === animationImgs.length ){
                    imgNum = 0;
                }
            }else if(playStyle ==='reverse'){
                imgNum += deltaImgNum;
                if(imgNum === -1 || imgNum === animationImgs.length){
                    deltaImgNum *= -1;
                    imgNum += deltaImgNum;
                }
            }
            ctx.drawImage(image, 0,0);
            
            if(capture !== null){
                capture.capture(canvas);
            }
        }
        if(domain.stopAnimating === true){
            clearTimeout(id);
        }else{
            setTimeout(arguments.callee, waitTime);
        }
    },waitTime)
}

function removeVariable(buttonElement){
    var parent = $(buttonElement).parent();
    parent.remove();
}

//chooses a random plot from the list and displays it
function randomGraph(){
    MQ = MathQuill.getInterface(2);
    var num = Math.random();
    var eqs;
    cartesian = false;
    cylindrical = false;
    spherical = false;
    if(num < .33){
        //choose a cartesian option
        eqs = cartGallery[Math.floor(Math.random()*cartGallery.length)];
        cartesian = true;
        var xInput = MQ.MathField(document.getElementById('x-input'));
        xInput.write(eqs[0]);
        var yInput = MQ.MathField(document.getElementById('y-input'));
        yInput.write(eqs[1]);
        var zInput = MQ.MathField(document.getElementById('z-input'));
        zInput.write(eqs[2]);
        $('#cartesian-button').click();
    }else if(num < .66){
        //choose a cylindrical option
        eqs = cylinFuncGallery[Math.floor(Math.random()*cylinFuncGallery.length)];
        cylindrical = true;
        var rhoInput = MQ.MathField(document.getElementById('rho-input'));
        rhoInput.write(eqs[0]);
        var phiInput = MQ.MathField(document.getElementById('phi-input'));
        phiInput.write(eqs[1]);
        var heightInput= MQ.MathField(document.getElementById('height-input'));
        heightInput.write(eqs[2]);
        $('#cylindrical-button').click();
    }else{
        //choose a spherical option
        eqs = sphereFuncGallery[Math.floor(Math.random()*sphereFuncGallery.length)];
        spherical = true;
        var rInput = MQ.MathField(document.getElementById('r-input'))
        rInput.write(eqs[0]);
        var thetaInput = MQ.MathField(document.getElementById('theta-input'))
        thetaInput.write(eqs[1]);
        var sphiInput = MQ.MathField(document.getElementById('sphi-input'))
        sphiInput.write(eqs[2]);
        $('#spherical-button').click();
    }
}

function getRealDomainCenter(){
    var newDomainCenter;
    if(domain.panCenter){
        newDomainCenter = {
            x:domain.panCenter.x - (-domain.center.x + domain.panCenter.x)/domain.x.spread,
            y:domain.panCenter.y - (-domain.center.y + domain.panCenter.y)/domain.y.spread,
            z:domain.panCenter.z - (-domain.center.z + domain.panCenter.z)/domain.z.spread
        }
    }else{
        newDomainCenter = domain.center;
    }
    return newDomainCenter;
}

function getRealDomainWidth(){
    return {
        x:(domain.x.max-domain.x.min)/domain.x.spread,
        y:(domain.y.max-domain.y.min)/domain.y.spread,
        z:(domain.z.max-domain.z.min)/domain.z.spread
    }
}

//sets the value of domain to the respective inputs
function changeDomainInputs(){
    MQ = MathQuill.getInterface(2);
    var newDomainCenter = getRealDomainCenter();
    var newDomainWidth = getRealDomainWidth();
    MQ($('#x-range-min-input')[0]).latex(newDomainCenter.x - newDomainWidth.x/2);
    MQ($('#x-range-max-input')[0]).latex(newDomainCenter.x + newDomainWidth.x/2);
    MQ($('#y-range-min-input')[0]).latex(newDomainCenter.y - newDomainWidth.y/2);
    MQ($('#y-range-max-input')[0]).latex(newDomainCenter.y + newDomainWidth.y/2);
    MQ($('#z-range-min-input')[0]).latex(newDomainCenter.z - newDomainWidth.z/2);
    MQ($('#z-range-max-input')[0]).latex(newDomainCenter.z + newDomainWidth.z/2);
    MQ($('#r-range-min-input')[0]).latex(domain.r.min);
    MQ($('#r-range-max-input')[0]).latex(domain.r.max);
    MQ($('#rho-range-min-input')[0]).latex(domain.rho.min);
    MQ($('#rho-range-max-input')[0]).latex(domain.rho.max);
    MQ($('#height-range-min-input')[0]).latex(domain.height.min);
    MQ($('#height-range-max-input')[0]).latex(domain.height.max);
}

function setUpDownload(){
    var select = document.getElementById('image-type-selector');
    var type = select.options[select.selectedIndex].value;
    var canvas = document.getElementById('canvas');
    var data = canvas.toDataURL('image/'+type);
    data = data.replace(/^data:image\/[^;]*/, 'data:application/octet-stream');
    data = data.replace(/^data:application\/octet-stream/, 'data:application/octet-stream;headers=Content-Disposition%3A%20attachment%3B%20filename=Graph.'+type);
    document.getElementById('save-href').href = data;
    document.getElementById('save-href').download = 'Graph.'+type;
}

function isParametric(){
    var xInput = $('#x-input').text();
    var yInput = $('#y-input').text();
    var zInput = $('#z-input').text();
    
    return (xInput.indexOf('u') !== -1 || xInput.indexOf('v') !== -1) ||
        (yInput.indexOf('u') !== -1 || yInput.indexOf('v') !== -1) ||
        (zInput.indexOf('u') !== -1 || zInput.indexOf('v') !== -1);
}

function isCylindricalParametric(){
    var rhoInput = $('#rho-input').text();
    var phiInput = $('#phi-input').text();
    var heightInput = $('#height-input').text();
    return (rhoInput.indexOf('u') !== -1 || rhoInput.indexOf('v') !== -1) ||
        (phiInput.indexOf('u') !== -1 || phiInput.indexOf('v') !== -1) ||
        (heightInput.indexOf('u') !== -1 || heightInput.indexOf('v') !== -1);
}

function isSphericalParametric(){
    var rInput = $('#r-input').text();
    var thetaInput = $('#theta-input').text();
    var sphiInput = $('#sphi-input').text();
    return (rInput.indexOf('u') !== -1 || rInput.indexOf('v') !== -1) ||
        (thetaInput.indexOf('u') !== -1 || thetaInput.indexOf('v') !== -1) ||
        (sphiInput.indexOf('u') !== -1 || sphiInput.indexOf('v') !== -1);
}

function evalDomain(div){
    MQ = MathQuill.getInterface(2);
    var input = parseLatex(MQ.MathField(div).latex(), animationVars);
    var scope = {};
    for(var j = 0; j < animationVars.length; j++){
        scope[animationVars[j].name] = animationVars[j].value;
    }
    return math.eval(input, scope);
    
}

function graph(onFinish){
    domain.stopAnimating = true;
    MQ = MathQuill.getInterface(2);
    if(!onFinish){
        onFinish = function(){};
    }
    if(!skipDomain){
        var variables = ['x','y','z','u','v','rho','phi','height','r','theta','sphi'];
        for(var k = 0; k < variables.length; k++){
            var name = variables[k];
            domain[name].min = evalDomain($('#'+name+'-range-min-input')[0]);
            domain[name].max = evalDomain($('#'+name+'-range-max-input')[0]);
        }
        
        if(cylindrical){
            domain.x.max = Math.max(Math.abs(domain.rho.max), Math.abs(domain.rho.min));
            domain.x.min = -Math.max(Math.abs(domain.rho.max), Math.abs(domain.rho.min));
            domain.y.max = domain.x.max;
            domain.y.min = domain.x.min;
            domain.z.min = domain.height.min;
            domain.z.max = domain.height.max;
        }
        
        if(spherical){
            var w = Math.max(Math.abs(domain.r.max), Math.abs(domain.r.min));
            domain.x.min = -w;
            domain.x.max = w;
            domain.y.min = -w;
            domain.y.max = w;
            domain.z.min = -w;
            domain.z.max = w;
        }
        var xWidth = domain.x.max - domain.x.min;
        var yWidth = domain.y.max - domain.y.min;
        var zWidth = domain.z.max - domain.z.min;
        
        var maxWidth = Math.max(xWidth, yWidth, zWidth);
        var xSpread = maxWidth / xWidth;
        var ySpread = maxWidth / yWidth;
        var zSpread = maxWidth / zWidth;
        
        domain.x.spread = xSpread;
        domain.y.spread = ySpread;
        domain.z.spread = zSpread;
        
        //the spread is basically a function.
        //it stretches the dimensions to fit the designated domain
        var spread = {x:xSpread, y:ySpread, z:zSpread};
        
        var xCenter = (domain.x.min + domain.x.max)/2;
        var yCenter = (domain.y.min + domain.y.max)/2;
        var zCenter = (domain.z.min + domain.z.max)/2;
        
        domain.center = {x:xCenter,y:yCenter,z:zCenter};
        
        domain.x.max = xCenter + xSpread * xWidth/2;
        domain.x.min = xCenter - xSpread * xWidth/2;
        domain.y.max = yCenter + ySpread * yWidth/2;
        domain.y.min = yCenter - ySpread * yWidth/2;
        domain.z.max = zCenter + zSpread * zWidth/2;
        domain.z.min = zCenter - zSpread * zWidth/2;
    }
    
    spread = {x:domain.x.spread, y:domain.y.spread, z:domain.z.spread}
    domain.center = getRealDomainCenter();
    
    domain.showAxes = $('#axes-checkbox').prop('checked');
    domain.coloring = $('#color-checkbox').prop('checked');
    
    points = [];
    pointQuats = [];
    axes = [
        [{w:0,x:1,y:0,z:0},{w:0,x:-1,y:0,z:0},{w:0,x:1,y:0,z:0},{w:0,x:-1,y:0,z:0}],
        [{w:0,x:0,y:1,z:0},{w:0,x:0,y:-1,z:0},{w:0,x:0,y:1,z:0},{w:0,x:0,y:-1,z:0}],
        [{w:0,x:0,y:0,z:1},{w:0,x:0,y:0,z:-1},{w:0,x:0,y:0,z:1},{w:0,x:0,y:0,z:-1}]
    ];
    
    var density = parseInt($('#density-input').text(),10);
    domain.density = density;
    syncAxes();
    
    //reset domain
    if(domain.pointsOnly === true){
        //rotatePoints(axes[0], totalQuat);
        //rotatePoints(axes[1], totalQuat);
        //rotatePoints(axes[2], totalQuat);
        pointQuats = [];
        points = [];
        domain.coloring = true;
        var table = $('#plot-table-body');
        var rows = table.children('tr');
        for(var q = 0; q < rows.length; q++){
            var cols = $(rows[q]).children('td');
            var hasAllComponents = true;
            for(var c = 0; c < cols.length; c++){
                if(cols[c].textContent.trim().length === 0){
                    hasAllComponents = false;
                }
            }
            if(cols.length === 3 && hasAllComponents){
                var x = cols[0].textContent;
                var y = cols[1].textContent;
                var z = cols[2].textContent;
                
                var realPoint;
                if(cylindrical){
                    realPoint = cylindricalToCartesian(x,y,z);
                    x = realPoint.x;
                    y = realPoint.y;
                    z = realPoint.z;
                }
                if(spherical){
                    realPoint = sphericalToCartesian(x,y,z);
                    x = realPoint.x;
                    y = realPoint.y;
                    z = realPoint.z;
                }
                
                x = spreadCoord(x, domain.x.min, domain.x.max, domain.x.spread);
                y = spreadCoord(y, domain.y.min, domain.y.max, domain.y.spread);
                z = spreadCoord(z, domain.z.min, domain.z.max, domain.z.spread);
                
                //make an octohedron around the point 
                //spread is included in domain
                var xOffset = (domain.x.max - domain.x.min)  * domain.pointWidthRatio;
                var yOffset = (domain.y.max - domain.y.min)  * domain.pointWidthRatio;
                var zOffset = (domain.z.max - domain.z.min)  * domain.pointWidthRatio;
                
                var p1 = {x:x + xOffset, y: y, z:z};
                var pD1 = pointToQuat(p1);
                var p2 = {x:x,y:y+yOffset,z:z}
                var pD2 = pointToQuat(p2)
                var p3 = {x:x - xOffset, y:y, z:z};
                var pD3 = pointToQuat(p3);
                var p4 = {x:x,y:y-yOffset,z:z};
                var pD4 = pointToQuat(p4);
                var p5 = {x:x,y:y,z:z+zOffset};
                var pD5 = pointToQuat(p5);
                var p6 = {x:x,y:y,z:z-zOffset};
                var pD6 = pointToQuat(p6);
                
                //repeat the top and bottom
                var p7 = {x:x,y:y,z:z+zOffset};
                var pD7 = pointToQuat(p7);
                var p8 = {x:x,y:y,z:z-zOffset};
                var pD8 = pointToQuat(p8);
                
                var nPoints = [p1, p2, p3, p4, p5, p6, p7, p8];
                var dPoints = [pD1, pD2, pD3, pD4, pD5, pD6, pD7, pD8];
                
                for(var v = 0; v < nPoints.length; v++){
                    rotate(nPoints[v],totalQuat);
                    rotate(dPoints[v],totalQuat);
                }
                
                //connections
                p1.polygon = {pts:[p1,p2,p5]}
                p2.polygon = {pts:[p2,p3,p5]}
                p3.polygon = {pts:[p3,p4,p6]}
                p4.polygon = {pts:[p4,p1,p6]}
                p5.polygon = {pts:[p5,p4,p3]}
                p6.polygon = {pts:[p6,p1,p2]}
                p7.polygon = {pts:[p7,p4,p1]}
                p8.polygon = {pts:[p8,p2,p3]}
                
                for(var b = 0; b < nPoints.length; b++){
                    nPoints[b].index = points.length;
                    points.push(nPoints[b]);
                }
                
                pD1.polygon = {pts:[pD1,pD2,pD5]}
                pD2.polygon = {pts:[pD2,pD3,pD5]}
                pD3.polygon = {pts:[pD3,pD4,pD6]}
                pD4.polygon = {pts:[pD4,pD1,pD6]}
                pD5.polygon = {pts:[pD5,pD4,pD3]}
                pD6.polygon = {pts:[pD6,pD1,pD2]}
                pD7.polygon = {pts:[pD7,pD4,pD1]}
                pD8.polygon = {pts:[pD8,pD2,pD3]}
                
                for(b = 0; b < dPoints.length; b++){
                    pointQuats.push(dPoints[b]);
                }
            }
        }
        plotPoints();
        
    }else{
        if(cartesian){
            var xInput = MQ.MathField(document.getElementById('x-input')).latex();
            xInput = parseLatex(xInput, animationVars);
            var yInput = MQ.MathField(document.getElementById('y-input')).latex();
            yInput = parseLatex(yInput, animationVars);
            var zInput = MQ.MathField(document.getElementById('z-input')).latex();
            zInput = parseLatex(zInput, animationVars);
            
            var parametric = false;
            
            var realCenter = getRealDomainCenter();
            var realWidth = getRealDomainWidth();
            if(isParametric()){
                parametric = true;
                $('#u-v-range-row').show();
                //graph parametric
                graphParametricFunction(xInput, yInput, zInput, spread, domain.shallowSketch, onFinish);
                    
            }else if(xInput.length > 0){
                yInput = 'u';
                domain.u.min = realCenter.y - realWidth.y/2;
                domain.u.max = realCenter.y + realWidth.y/2;
                zInput = 'v';
                domain.v.min = realCenter.z - realWidth.z/2;
                domain.v.max = realCenter.z + realWidth.z/2;
                graphParametricFunction(xInput, yInput, zInput, spread,domain.shallowSketch, onFinish);
            }else if(yInput.length > 0){
                xInput = 'u';
                domain.u.min = realCenter.x - realWidth.x/2;
                domain.u.max = realCenter.x + realWidth.x/2;
                zInput = 'v';
                domain.v.min = realCenter.z - realWidth.z/2;
                domain.v.max = realCenter.z + realWidth.z/2;
                graphParametricFunction(xInput, yInput, zInput, spread,domain.shallowSketch, onFinish);
            }else if(zInput.length > 0){
                xInput = 'u';
                domain.u.min = realCenter.x - realWidth.x/2;
                domain.u.max = realCenter.x + realWidth.x/2;
                yInput = 'v';
                domain.v.min = realCenter.y - realWidth.y/2;
                domain.v.max = realCenter.y + realWidth.y/2;
                graphParametricFunction(xInput, yInput, zInput, spread,domain.shallowSketch, onFinish);
            }
            if(parametric === false){
                //show xyz range
                $('#u-v-range-row').hide();
                
            }
            $('#cartesian-button').click();
        }else if(cylindrical){
            var rhoInput = MQ.MathField(document.getElementById('rho-input')).latex();
            rhoInput = parseLatex(rhoInput, animationVars);
            var phiInput = MQ.MathField(document.getElementById('phi-input')).latex();
            phiInput = parseLatex(phiInput, animationVars);
            var heightInput = MQ.MathField(document.getElementById('height-input')).latex();
            heightInput = parseLatex(heightInput, animationVars);
            if(isCylindricalParametric()){
                //deal with any dependancies 
                for(var b=0; b < 3; b++){
                    rhoInput = rhoInput.replace(/phi/g,phiInput);
                    rhoInput = rhoInput.replace(/\(z\)/g,'('+heightInput+')');
                    phiInput = phiInput.replace(/rho/g,rhoInput);
                    phiInput = phiInput.replace(/\(z\)/g,'('+heightInput+')');
                    heightInput = heightInput.replace(/phi/g,phiInput);
                    heightInput = heightInput.replace(/rho/g,rhoInput);
                }
                xInput = '('+rhoInput+')' + 'cos('+phiInput+')';
                yInput = '('+rhoInput+')' + 'sin('+phiInput+')';
                zInput = heightInput;
                
                $('#u-range-row').show();
                $('#v-range-row').show();
                
                graphParametricFunction(xInput, yInput, zInput, spread,domain.shallowSketch, onFinish);
            }else{
                //can graph this parametrically
                if(rhoInput.length > 0){
                    rhoInput = rhoInput.replace(/\(z\)/g,'(u)');
                    rhoInput = rhoInput.replace(/phi/g, 'v');
                    zInput = 'u';
                    xInput = '('+rhoInput+')cos(v)';
                    yInput = '('+rhoInput+')sin(v)';
                    domain.u.min = domain.height.min;
                    domain.u.max = domain.height.max;
                    domain.v.min = domain.phi.min;
                    domain.v.max = domain.phi.max;
                    graphParametricFunction(xInput, yInput, zInput,spread,domain.shallowSketch, onFinish);
                }else if(phiInput.length > 0){
                    phiInput = phiInput.replace(/\(z\)/g,'(u)');
                    phiInput = phiInput.replace(/rho/g,'v');
                    zInput = 'u';
                    xInput = 'v*cos('+phiInput+')';
                    yInput = 'v*sin('+phiInput+')';
                    domain.u.min = domain.height.min;
                    domain.u.max = domain.height.max;
                    domain.v.min = domain.rho.min;
                    domain.v.max = domain.rho.max;
                    graphParametricFunction(xInput, yInput, zInput, spread,domain.shallowSketch, onFinish);
                }else if(heightInput.length > 0){
                    zInput = heightInput;
                    xInput = 'cos(u)*v';
                    yInput = 'sin(u)*v';
                    zInput = zInput.replace(/rho/g,'v');
                    zInput = zInput.replace(/phi/g,'u');
                    domain.u.min = domain.phi.min;
                    domain.u.max = domain.phi.max;
                    domain.v.min = domain.rho.min;
                    domain.v.max = domain.rho.max;
                    graphParametricFunction(xInput, yInput, zInput, spread,domain.shallowSketch, onFinish);
                }
            }
            $('#cylindrical-button').click();
        }else if(spherical){
            var rInput = MQ.MathField(document.getElementById('r-input')).latex();
            rInput = parseLatex(rInput, animationVars);
            var thetaInput = MQ.MathField(document.getElementById('theta-input')).latex();
            thetaInput = parseLatex(thetaInput, animationVars);
            var sphiInput = MQ.MathField(document.getElementById('sphi-input')).latex();
            sphiInput = parseLatex(sphiInput, animationVars);
            
            if(!isSphericalParametric()){
                $('#u-range-row').hide();
                $('#v-range-row').hide();
                if(rInput.length > 0){
                    thetaInput = 'u';
                    domain.u.min = domain.theta.min;
                    domain.u.max = domain.theta.max;
                    sphiInput = 'v';
                    domain.v.min = domain.sphi.min;
                    domain.v.max = domain.sphi.max;
                    rInput = rInput.replace(/theta/g,'u');
                    rInput = rInput.replace(/phi/g,'v');
                }else if(thetaInput.length > 0){
                    rInput = 'u';
                    domain.u.min = domain.r.min;
                    domain.u.max = domain.r.max;
                    sphiInput = 'v';
                    domain.v.min = domain.sphi.min;
                    domain.v.max = domain.sphi.max;
                    thetaInput = thetaInput.replace(/\(r\)/g,'(u)');
                    thetaInput = thetaInput.replace(/phi/g,'v');
                }else if(sphiInput.length >0){
                    rInput = 'u';
                    domain.u.min = domain.r.min;
                    domain.u.max = domain.r.max;
                    thetaInput = 'v';
                    domain.v.min = domain.theta.min;
                    domain.v.max = domain.theta.max;
                    sphiInput = sphiInput.replace(/\(r\)/g,'(u)');
                    sphiInput = sphiInput.replace(/theta/g,'v');
                }
            }else{
                $('#u-range-row').show();
                $('#v-range-row').show();
            }
            
            for(var h = 0; h < 3; h++){
                rInput = rInput.replace('theta',thetaInput);
                rInput = rInput.replace('phi',sphiInput);
                thetaInput = thetaInput.replace('(r)','('+rInput+')');
                thetaInput = thetaInput.replace('phi',sphiInput);
                sphiInput = sphiInput.replace('(r)','('+rInput+')');
                sphiInput = sphiInput.replace('theta',thetaInput);
            }
            
            xInput = '('+rInput+')'+'*'+'sin('+sphiInput+')*cos('+thetaInput+')';
            yInput = '('+rInput+')'+'*'+'sin('+sphiInput+')*sin('+thetaInput+')';
            zInput = '('+rInput+')'+'*'+'cos('+sphiInput+')';
            graphParametricFunction(xInput, yInput, zInput, spread,domain.shallowSketch, onFinish);
            
            $('#spherical-button').click();
        }
    }
}

function sphericalToCartesian(r, theta, phi){
    return {x: r * Math.sin(phi) * Math.cos(theta), y: r * Math.sin(phi) * Math.sin(theta), z: r * Math.cos(phi)};
}

function cylindricalToCartesian(rho, phi, z){
    return {x: rho*Math.cos(phi), y: rho*Math.sin(phi), z:z};
}

$('#graph-button').click(function(){
    graph();
})

function refreshMathJax(){
    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
}

function graphParametricFunction(xFunc, yFunc, zFunc, spread, draw, onFinish){
    syncAxes();
    pointQuats = [];
    
    var uTotal = domain.u.max - domain.u.min;
    var vTotal = domain.v.max - domain.v.min;
    
    var uJump = uTotal / domain.density;
    var vJump = Math.sqrt(3)/2 * vTotal / domain.density;
    var a = 0;
    
    for(var k = 0; k < 2; k++){
        xFunc = xFunc.replace(/\(y\)/g,'('+yFunc+')');
        xFunc = xFunc.replace(/\(z\)/g,'('+zFunc+')');
        
        yFunc = yFunc.replace(/\(x\)/g,'('+xFunc+')');
        yFunc = yFunc.replace(/\(z\)/g,'('+zFunc+')');
        
        zFunc = zFunc.replace(/\(x\)/g,'('+xFunc+')');
        zFunc = zFunc.replace(/\(y\)/g,'('+yFunc+')');
    }
    
    var intervalXFunc = compile(xFunc);
    var intervalYFunc = compile(yFunc);
    var intervalZFunc = compile(zFunc);
    intervalFunctionSupported = true;
    try{
        intervalXFunc.eval({u:0,v:0});
        intervalYFunc.eval({u:0,v:0});
        intervalZFunc.eval({u:0,v:0});
    }catch(err){
        intervalFunctionSupported = false;
    }
    
    xFunc = math.compile('x='+xFunc);
    yFunc = math.compile('y='+yFunc);
    zFunc = math.compile('z='+zFunc);
    
    try{
        plot(xFunc, yFunc, zFunc, 0, 0)
    }catch(err){
        console.log('error caught!'+err.stack)
        displayCanvasError()
        graphingError = true;
        return;
    }
    graphingError = false;
    
    var color = false;
    if(domain.coloring){
        color = true;
    }
    domain.coloring = false;
    
    plotPoints();
    
    if(graphing === false){
        graphing = true;
    }else{
        clearInterval(intervalId);
        clearInterval(intervalId2);
        clearInterval(intervalId3);
        clearInterval(intervalId4);
        clearInterval(intervalId5);
    }
    
    graphParametricFunction2(xFunc, yFunc, zFunc, function(){
        syncQuats();
        domain.coloring = color;
        plotPoints();
    })
    return;
    
    var pointsToPush = [];
    polygons = [];
    intervalId = setInterval(function(){
        if(a * uJump < uTotal){
            var rowsGraphed = 0;
            for(var b = 0; b < handleablePoints/domain.density && a * uJump < uTotal; b++){
                rowsGraphed++;
                var u = domain.u.min + a * uJump;
                graphParametricRow(vJump, a, vTotal, xFunc, yFunc, zFunc,u, intervalXFunc, intervalYFunc, intervalZFunc, pointsToPush);
                a++;
                domain.percentCalculated = a*uJump / uTotal;
            }
            onlyPlotNewPoints = true;
            pointsToPlot = domain.density * rowsGraphed;
            plotPoints();
            displayCanvasMessage('drawing... '+(domain.percentCalculated*100).toFixed(2)+'%');
            onlyPlotNewPoints = false;
        }else{
            formPolygons(a);
            clearInterval(intervalId);
            for(var k = 0; k < pointsToPush.length; k++){
                pointsToPush[k].index = points.length;
                points.push(pointsToPush[k]);
            }
            onlyPlotNewPoints = false;
            cleanParametricEdges(xFunc, yFunc, zFunc, function(){
                recursiveMeshGeneration(xFunc, yFunc, zFunc, 1,function(){
                    syncQuats();
                    
                    domain.coloring = color;
                    if(draw){
                        plotPoints(spread);
                    }
                    
                    graphing = false;
                    if(onFinish){
                        onFinish();
                    }
                })
            });
        }
    },10);
}

function formPolygons(colTotal){
    var toIndex = (x,y) => domain.rowLength*x + y;
    var newPoly = inds => polygons.push({
        indices:inds,
        pts:[]
    });
    for(var x = 0; x < colTotal - 1; x++){
        for(var y = 0; y < domain.rowLength; y++){
            if(y % 2 === 0){
                newPoly([toIndex(x,y),toIndex(x+1,y),toIndex(x,y+1)]);
                newPoly([toIndex(x+1,y+1),toIndex(x+1,y),toIndex(x,y+1)]);
            }else if(y < domain.rowLength - 1){
                newPoly([toIndex(x,y),toIndex(x,y+1),toIndex(x+1,y+1)]);
                newPoly([toIndex(x,y),toIndex(x+1,y),toIndex(x+1,y+1)]);
            }
        }
    }
}

//plot the point, computes its 1st partial derivatives (dx/du, dx/dv etc) and its 2nd parial derivatives (dx^2/du, etc)
function plotPlus(xfunc, yfunc, zfunc, u,v,delta){
    if(!delta){
        delta = Math.min((domain.u.max-domain.u.min)/1e6, (domain.v.max-domain.v.min)/1e6);
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

function displayCanvasError(){
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0,0, width, height);
    
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.3)'
    ctx.font = '50px Arial';
    
    ctx.fillText('Whoops! There was an error :(', width/2, height/2, width);
}

function displayCanvasMessage(message){
    //grey out canvas
     var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    ctx.font = '15px Arial';
    ctx.fillStyle = domain.backgroundColor == 'dark' ? '#222222' : 'white';
    ctx.fillRect(0, canvas.height - 25, canvas.width, 25);
    ctx.fillStyle = domain.backgroundColor == 'dark' ? '#dddddd' : 'black';
    ctx.fillText(message, 155, canvas.height - 12);
    
}

function recursiveMeshGeneration(xFunc, yFunc, zFunc,iteration,onfinish){
    onfinish();
    return;
}

function graphParametricRow(vJump, a, vTotal, xFunc, yFunc, zFunc,u, intervalXFunc, intervalYFunc, intervalZFunc, pointsToPush){
    if(a === 0){
        domain.rowLength = 0;
    }
    var vDensity = domain.rowLength;
    for(var b = 0; b*vJump < vTotal; b++){
        if(a === 0){
            domain.rowLength ++;
        }
        var v = domain.v.min + b * vJump;
        var newU = u + ((b % 2 === 0) ? 0 : 2/Math.sqrt(3)*vJump / 2);
        var point = plot(xFunc, yFunc, zFunc, newU, v)
        point.index = points.length;
        
        var drawingPt = pointToQuat(point);
        drawingPt.neighbors = [];
        
        if(a > 0){
            makeConnection(point, points[points.length - vDensity]);
            makeConnection(drawingPt, pointQuats[pointQuats.length - vDensity])
            if(b % 2 == 0){
                if(b > 0){
                    makeConnection(point, points[points.length - vDensity - 1])
                    makeConnection(drawingPt, pointQuats[pointQuats.length - vDensity - 1]);
                }
                if(b < vDensity - 1){
                    makeConnection(point, points[points.length - vDensity + 1])
                    makeConnection(drawingPt, pointQuats[pointQuats.length - vDensity + 1]);
                }
            }
        }
        if(b > 0){
            makeConnection(point, points[points.length - 1]);
            makeConnection(drawingPt, pointQuats[pointQuats.length - 1]);
        }
        
        var hasInfiniteDiscontinuity = false;
        //deal with infinite stuff
        for(var h = 0; h < point.neighbors.length && intervalFunctionSupported; h++){
            var scope = {
                u:[point.neighbors[h].pt.u, point.u], 
                v:[point.neighbors[h].pt.v, point.v]
            };
            for(var j = 0; j < animationVars.length; j++){
                scope[animationVars[j].name] = animationVars[j].value;
            }
            var intervalX = intervalXFunc.eval(scope);
            var intervalY = intervalYFunc.eval(scope);
            var intervalZ = intervalZFunc.eval(scope);
            if(intervalZ.hi === Infinity || intervalZ.lo === -Infinity 
                || intervalX.hi === Infinity || intervalX.lo === -Infinity
                || intervalY.hi === Infinity || intervalY.lo === -Infinity){
                
                hasInfiniteDiscontinuity = true;
                var otherPt = point.neighbors[h].pt;
                
                var range = isolateAsymptote(otherPt, point, point.v, intervalXFunc, intervalYFunc, intervalZFunc, 8);
                
                var newPoint = plot(xFunc, yFunc, zFunc, range[1].u, range[1].v);
                //used to trigger edge finding algorithm
                newPoint.z = null;
                
                var newOtherPt = plot(xFunc, yFunc, zFunc, range[0].u, range[0].v);
                newOtherPt.z = null;
                
                removeConnection(point, otherPt);
                makeConnection(otherPt, newOtherPt);
                makeConnection(newOtherPt, newPoint);
                makeConnection(newPoint, point);
                
                pointsToPush.push(newPoint);
                pointsToPush.push(newOtherPt);
            }
        }
        
        //setTotalQuat();
        rotate(drawingPt,totalQuat);
        
        pointQuats.push(drawingPt);
        points.push(point);
    }
}

function graphParametricFunction2(xFunc, yFunc, zFunc, onfinish){
    //for non-real points, how far to go
    var defaultDeltaU = (domain.u.max - domain.u.min) / domain.density, 
        defaultDeltaV = (domain.v.max - domain.v.min) / domain.density;
    
    //sometimes I'm really thankful I stretched the function instead of the domain...
    var defaultXYZLength = (domain.x.max - domain.x.min) / domain.density;
    var legLength = defaultXYZLength;
    
    points = [];
    pointQuats = [];
    polygons = [];
    
    //center of domain, the seed point
    var uMiddle = (domain.u.max + domain.u.min) / 2,
        vMiddle = (domain.v.max + domain.v.min) / 2;
        
    var referencePt;
    
    //where 1 s = 1 legLength
    var s = sCoord => sCoord*legLength / referencePt.deriv1.du;
    var t = tCoord => tCoord*legLength / referencePt.deriv1.dv;
    
    function generatingVecs(){
        //we want (v1.u * |du|)^2 + (v1.v * |dv|)^2 == legLength^2, and the same for v2
        //for v1, we just assume v = 0
        var du = referencePt.deriv1.du,
            dv = referencePt.deriv1.dv
        var v1 = {
            u: legLength / magnitude(du),
            v:0
        };
        //this is essentially a projection
        //for future reference, think of du and dv embedded in xyz space, need new vector
        //pointing "toward" dv but perpendicular to du, in uv coordinates
        var v2 = {
            u:-dot(du, dv) / dot(du, du),
            v:1
        }
        //now scale v2 to its length is legLength
        var sc = legLength / magnitude( add( scalar(v2.u, du), scalar(v2.v, dv) ) );
        v2.u *= sc;
        v2.v *= sc;
        
        return [v1,v2];
    }
    
    //returns the uv coordinates of a coordinate specified in perpendicular, normalized (via legLength)
    //  coordinates, with the first coordinate parallel to the du vector
    function dir(s,t){
        var vecs = generatingVecs();
        var v1 = vecs[0];
        var v2 = vecs[1];
        
        return {
            u: v1.u * s + v2.u * t,
            v: v1.v * s + v2.v * t
        };
    }
    
    //inverse of dir function
    function invDir(u,v){
        var vecs = generatingVecs();
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
    
    var initPoint = plotPlus(xFunc, yFunc, zFunc, uMiddle, vMiddle);
    referencePt = initPoint;
    //we have (x(u,v), y(u,v), z(u,v)) ≈ u du + v dv, so a linear transformation (a plane)
    //in order for a parameterization (x(s,t), y(s,t), z(s,t)) such that a change in s and t corresponds to 
    //an equal change in x,y and z, we need s = u du, t = v dv, or (u(s,t), v(s,t)) = (s / |du|, t / |dv|)
    var vec = dir(1, 0);
    console.log('perp check!')
    console.log(
        dot(
            add(scalar(dir(1,0).u,referencePt.deriv1.du), scalar(dir(1,0).v,referencePt.deriv1.dv)), 
            add(scalar(dir(0,1).u,referencePt.deriv1.du), scalar(dir(0,1).v,referencePt.deriv1.dv))
        )
    )
    var initPoint2 = plotPlus(xFunc, yFunc, zFunc, uMiddle + vec.u, vMiddle + vec.v);
    vec = dir(.5, Math.sqrt(3)/2)
    var initPoint3 = plotPlus(xFunc, yFunc, zFunc, uMiddle + vec.u, vMiddle + vec.v)
    
    //the space that needs to be transversed goes counter-clockwise from beginning to end
    initPoint.beginning = initPoint3;
    initPoint.end = initPoint2;
    
    initPoint2.beginning = initPoint;
    initPoint2.end = initPoint3;
    
    initPoint3.beginning = initPoint2;
    initPoint3.end = initPoint;
    
    connectLoop(initPoint, initPoint2, initPoint3);
    
    points.push(initPoint);
    initPoint.index = 0;
    points.push(initPoint2);
    initPoint2.index = 1;
    points.push(initPoint3);
    initPoint3.index = 2;
    
    polygons.push({
        indices:[0,1,2],
        pts:[]
    });
    
    var pointFront = [initPoint, initPoint2, initPoint3];
    var distFunc = p => Math.sqrt(p.u*p.u+p.v*p.v);
    pointFront.sort(function(a,b){
        return distFunc(a) - distFunc(b);
    })
    
    //we want to take care of concave angles before ALL the convex angles
    //as to prevent overlap
    var entirelyConvex = true;
    
    function calcAngle(pt){
        referencePt = pt;
        //start point
        var sPoint = pt.beginning;
        //end point
        var ePoint = pt.end;
        
        //where the start and endPoints are in square coordinates
        var sST = invDir(sPoint.u - pt.u, sPoint.v - pt.v);
        var eST = invDir(ePoint.u - pt.u, ePoint.v - pt.v);
        
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
    
    function pushToPointFront(pt){
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
    
    function processPoint(pt, edgePoints){
        referencePt = pt;
        
        var n1 = pt.beginning.beginning;
        var n2 = pt.end.end;
        
        //if the length from connection point to the base point is less than the distance from the 
        //base point to n1 or n2, then there is garunteed (I think) no overlap with 2nd or higher neighbors
        var maxLength = Math.min(magnitude(sub(pt, n1)), magnitude(pt, n2));
        legLength = maxLength < defaultXYZLength ? maxLength : defaultXYZLength;
        
        //start point
        var sPoint = pt.beginning;
        //end point
        var ePoint = pt.end;
        
        //where the start and endPoints are in square coordinates
        var sST = invDir(sPoint.u - pt.u, sPoint.v - pt.v);
        var eST = invDir(ePoint.u - pt.u, ePoint.v - pt.v);
        
        //in square coordinates, we can do normal geometry (hurray!)
        var sAngle = Math.atan2(sST.t, sST.s);
        var eAngle = Math.atan2(eST.t, eST.s);
        
        //find counterclockwise difference between start and end angles
        var angleDiff = eAngle >= sAngle ? eAngle - sAngle : 2*Math.PI - (sAngle - eAngle);
        
        //we're shooting for equillateral triangles, so our angles should be as close to Pi/3 as possible
        var sections = Math.round(angleDiff / (Math.PI / 3)+0.4);
        if(sections === 0){
            sections = 1;
        }
        //console.log('total angle: '+angleDiff)
        //console.log('sections: '+sections)
        var angleDelta = angleDiff / sections;
        
        var currentAngle = sAngle+angleDelta;
        
        var genPoint = sPoint;
        var connectionPoint;
        
        for(var sCount = 0; sCount < sections; sCount++){
            //make connectionPoint as if it was the end of the loop
            vec = dir(Math.cos(currentAngle), Math.sin(currentAngle));
            
            //stop at edge of domain
            var withinDomain = true;
            if(pt.u + vec.u > domain.u.max){
                withinDomain = false;
            }
            if(pt.u + vec.u < domain.u.min){
                withinDomain = false;
            }
            if(pt.v + vec.v > domain.v.max){
                withinDomain = false;
            }
            if(pt.v + vec.v < domain.v.min){
                withinDomain = false;
            }
            
            connectionPoint = plotPlus(xFunc, yFunc, zFunc, pt.u + vec.u, pt.v + vec.v);
            
            if(!withinDomain){
                edgePoints.push(connectionPoint);
            }
            
            //If a point crosses the line caused by pt.beginning and n1, it allows for interior line segments 
            //(e.g. pointing inward instead of outward),
            //This is bad
            var n1Fault = false;
            var n2Fault = false;
            //is the new segment pointing in the same direction as the neighbor segment?
            //is the new segment on the wrong side of the neighbor segment?
            //is the neighbor segment in the right position for such an overlap to be possible?
            if(uvDot(connectionPoint, pt.beginning, n1) > 0 && isClockwise(connectionPoint, pt.beginning, n1) && isClockwise(n1, pt.beginning, pt)){
                n1Fault = true;
                console.log('n1 (beginning) fault');
            }
            if(uvDot(connectionPoint, pt.end, n2) > 0 && !isClockwise(connectionPoint, pt.end, n2) && !isClockwise(n2, pt.end, pt)){
                n2Fault = true;
                console.log('n2 (end) fault');
            }
            
            if((magnitude(sub(connectionPoint, n1)) < legLength / 3 || n1Fault) && (withinDomain || n1Fault) && sCount !== sections-1){
                console.log('BEGINNING SNAP')
                //this is a 'beginning' snap
                connectionPoint = n1;
                
                makeConnection(pt, connectionPoint);
                
                //remove genPoint
                pointFront.splice(pointFront.indexOf(genPoint), 1);
                
                //fix beginnings/endings (there is no new point)
                connectionPoint.end = pt;
                
                //make polygon
                polygons.push({
                    indices:[pt.index, connectionPoint.index, genPoint.index],
                    pts:[]
                });
                
                genPoint = connectionPoint;
                //technically this should be changed so that the current angle is angleDelta + (connectionPoint Angle)
                //I expect a moderate smoothing effect (e.g. less sharp angles), but it is probably optional
                //I'll do it later
                currentAngle += angleDelta;
                //if the end is close enough OR it's the edge and not a fault
            }else if((magnitude(sub(connectionPoint, n2)) < legLength / 3 || n2Fault) && (withinDomain || n2Fault) && sCount !== sections-1){
                console.log('ENDING SNAP')
                //this is an 'ending' snap, slightly more complicated
                //this is garunteed to be the last section, so we'll break at the end
                connectionPoint = n2;
                
                makeConnection(connectionPoint, genPoint);
                makeConnection(connectionPoint, pt);
                
                //remove the excess point
                pointFront.splice(pointFront.indexOf(pt.end),1);
                
                //fix beginnings/ends
                connectionPoint.beginning = genPoint;
                genPoint.end = connectionPoint;
                
                //now there are two polygons to add
                polygons.push({
                    indices:[pt.index, connectionPoint.index, genPoint.index],
                    pts:[]
                });
                polygons.push({
                    indices:[pt.index, connectionPoint.index, pt.end.index],
                    pts:[]
                });
                
                break;
            }else{
                //there is no snap, continue as normal
                if(sCount === sections - 1){
                    connectionPoint = ePoint;
                    //if the distance to ePoint is too big, we'll split it
                    if(magnitude(sub(ePoint, pt)) > 1.25 * legLength){
                        console.log('end point split')
                        //add a point in between to even things out
                        var newU = (ePoint.u + pt.u)/2,
                            newV = (ePoint.v + pt.v)/2;
                        var nPt = plotPlus(xFunc, yFunc, zFunc, newU, newV);
                        
                        makeConnection(nPt, pt);
                        makeConnection(nPt, ePoint);
                        
                        //ePoint is always the end
                        nPt.end = ePoint;
                        ePoint.beginning = nPt;
                        
                        nPt.beginning = pt;
                        pt.end = nPt;
                        
                        pushToPointFront(nPt);
                        points.push(nPt);
                        nPt.index = points.length - 1;
                        
                        polygons.push({
                            indices:[pt.index, nPt.index, ePoint.index],
                            pts:[]
                        });
                        
                        connectionPoint = nPt;
                    }
                }else{
                    connectionPoint.end = pt;
                    makeConnection(connectionPoint, pt);
                    points.push(connectionPoint);
                    connectionPoint.index = points.length - 1;
                    
                    if(withinDomain){
                        pushToPointFront(connectionPoint);
                    }
                }
                
                //console.log('section made')
                
                //first connect the genPoint and connectionPoint
                makeConnection(genPoint, connectionPoint);
                
                //now reassign beginning and end assignments
                connectionPoint.beginning = genPoint;
                genPoint.end = connectionPoint;
                
                //now make the polygon
                polygons.push({
                    indices:[pt.index, connectionPoint.index, genPoint.index],
                    pts:[]
                });
                
                //cleanup
                genPoint = connectionPoint;
                currentAngle += angleDelta;
            }
        }
        pointFront.splice(pointFront.indexOf(pt),1);
        console.log('pf')
    }
    
    //in order not to mess up the mesh as its graphing, we'll squish the 
    //necessary edge points after the fact
    var edgePoints = [];
    
    var c = 0;
    while(pointFront.length > 0 && c < 466){
        c++;
        processPoint(pointFront[0], edgePoints);
    }
    
    //move all the edge points back into the domain
    for(var k = 0; k < edgePoints.length; k++){
        var pt = edgePoints[k];
        var u = pt.u, v = pt.v;
        u = u > domain.u.max ? domain.u.max : u;
        u = u < domain.u.min ? domain.u.min : u;
        v = v > domain.v.max ? domain.v.max : v;
        v = v < domain.v.min ? domain.v.min : v;
        
        pt.u = u;
        pt.v = v;
        
        var newPt = plot(xFunc, yFunc, zFunc, pt.u, pt.v);
        pt.x = newPt.x;
        pt.y = newPt.y;
        pt.z = newPt.z;
    }
    
    onfinish();
}

function makeConnection(pt1, pt2){
    if(!pt2 || !pt1){
        throw new Error('pt1 or pt2 is null')
    }
    pt1.neighbors.push({
        draw:true,
        pt:pt2
    });
    pt2.neighbors.push({
        draw:false,
        pt:pt1
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

function averageValue(pts){
    var sum = {x:0,y:0,z:0};
    for(var i = 0; i < pts.length; i++){
        if(!pts[i]){
            return 99999999;
        }
        sum.x += pts[i].x;
        sum.y += pts[i].y;
        sum.z += pts[i].z;
    }
    return {x:sum.x / pts.length, y:sum.y / pts.length, z:sum.z / pts.length};
}

function getRealPart(val){
    return val.im ? undefined : val;
}

function setTotalQuat(){
    var originalQuat = {w:0,x:1,y:0,z:0};
    var finalQuat = unitQuat;
    //thanks to http://stackoverflow.com/questions/1171849/finding-quaternion-representing-the-rotation-from-one-vector-to-another
    var a = cross(originalQuat, finalQuat)
    totalQuat.x = a.x;
    totalQuat.y = a.y;
    totalQuat.z = a.z;
    totalQuat.w = 1 + dot(originalQuat, finalQuat);
    quatNorm(totalQuat);
    
    rotate(originalQuat, totalQuat);
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

//gives the determinant of an n x n matrix
function det(matrix){
    var width = matrix.length;
    if(width === 2){
        return matrix[0][0]*matrix[1][1] - matrix[1][0]*matrix[0][1];
    }
    var determinant = 0;
    for(var k = 0; k < width; k++){
        var remaining = [];
        for(var r = 0; r< width - 1; r++){
            var sub = []
            for(var m = 0; m < width-1; m++){
                sub.push(0);
            }
            remaining.push(sub);
        }
        for(var x = 0; x < width; x++){
            for(var y = 1; y < width; y++){
                if(x !== k){
                    if(x < k){
                        remaining[y-1][x] = matrix[y][x];
                    }else{
                        remaining[y-1][x-1] = matrix[y][x];
                    }
                }
            }
        }
        determinant += matrix[0][k]*det(remaining);
    }
    return determinant;
}

function copyPoint(point){
    return {x:point.x,y:point.y,z:point.z};
}

function cleanParametricEdges(xFunc, yFunc, zFunc, doneFunc){
    var pointsToAdd = [];
    var p = 0;
    var previousPercent = 0;
    intervalId2 = setInterval(function(){
        if(p < points.length){
            for(var t = 0; t < handleablePoints/10 && p < points.length; t++){
                cleanNextPoint(xFunc, yFunc, zFunc, p, pointsToAdd);
                p++;
                var percentDone = p / points.length;
                percentDone *= 100;
                percentDone = parseFloat(percentDone.toFixed(2));
                if(percentDone > previousPercent + 1){
                    displayCanvasMessage('detecting edges... '+percentDone+'%');
                    previousPercent = percentDone;
                }
            }
        }else{
            clearInterval(intervalId2);
            var edges=[];
            addEdgePoints(pointsToAdd, edges, function(){
                removeNullPoints(function(){
                    cleanPolygonEdges(edges, function(){
                        doneFunc();
                    });
                });
            });
        }
    },10);
}

function addEdgePoints(pointsToAdd,edges, doneFunc){
    var k = 0;
    intervalId4 = setInterval(function(){
        if(k < pointsToAdd.length){
            for(var p = 0; p < handleablePoints && k < pointsToAdd.length; p++){
                points.push(pointsToAdd[k]);
                edges.push(pointsToAdd[k]);
                pointsToAdd[k].used = false;
                pointsToAdd[k].sourced = false;
                k++;
            }
            displayCanvasMessage('adding new edge points... '+(100*k/pointsToAdd.length).toFixed(2)+'%');
        }else{
            clearInterval(intervalId4);
            doneFunc();
        }
    },10);
}

function removeNullPoints(doneFunc){
    var a = points.length-1;
    var newPoints = [];
    intervalId5 = setInterval(function(){
        if(a>=0){
            for(var j = 0 ; j < 5000 && a >=0; j++){
                var pt = points[a];
                //if the point is real
                if(!isNonReal(pt)){
                    newPoints.push(pt);
                }else{
                    //remove any extraneous connections
                    for(var k = pt.neighbors.length - 1; k >= 0; k--){
                        removeConnection(pt, pt.neighbors[k].pt);
                    }
                }
                a--;
            }
            displayCanvasMessage('removing non-real points... '+(100*(points.length-a)/points.length).toFixed(2)+'%');
        }else{
            points = newPoints;
            clearInterval(intervalId5);
            doneFunc();
        }
    },10)
}

function cleanNextPoint(xFunc, yFunc, zFunc, p, pointsToAdd){
    var point = points[p];
    for(var t = 0; t < point.neighbors.length; t++){
        var otherPt = point.neighbors[t].pt;
        var realInbetweenPt;
        if(isNonReal(otherPt) && !isNonReal(point)){
            //interpolate between points
            realInbetweenPt = findParametricEdge(point, otherPt, xFunc, yFunc, zFunc, cleanDensity);
            var toAddPt = plot(xFunc, yFunc, zFunc, realInbetweenPt.u, realInbetweenPt.v)
            
            removeConnection(point, otherPt);
            makeConnection(point, toAddPt);
            
            toAddPt.cleaned = true;
            
            pointsToAdd.push(toAddPt)
        }
    }
}

function cleanPolygonEdges(edges, doneFunc){
    //the idea is to find a string of endpoints and connect them together
    var ptsUsed = 0;
    var nextPt = edges[0];
    if(nextPt){
        nextPt.used = true;
        var loopStarter = nextPt;
        var pointsInLoop = 0;
        var pt1;
        intervalId3 = setInterval(function(){
            if(ptsUsed < edges.length){
                for(var h = 0; h < handleablePoints/10 && ptsUsed < edges.length; h++){
                    if(pointsInLoop === 3 && pt1 !== loopStarter){
                        loopStarter.used = false;
                    }
                    pt1 = nextPt;
                    pt1.sourced = true;
                    var minPt = null;
                    var minLength = 1.5*(domain.u.max - domain.u.min)/ domain.density;
                    for(var u = 0; u < edges.length; u++){
                        var pt2 = edges[u];
                        if(pt2.used === false){
                            var length = uvDist(pt1, pt2);
                            var xyzlen = xyzDist(pt1, pt2);
                            if(xyzlen > Math.max(domain.z.max - domain.z.min, domain.x.max - domain.x.min, domain.y.max - domain.y.min)){
                                length = minLength + 1;
                            }
                            if(length  < minLength){
                                minLength = length;
                                minPt = pt2;
                            }
                        }
                    }
                    
                    if(minPt !== null){
                        makeConnection(pt1, minPt)
                        minPt.used = true;
                        nextPt = minPt;
                        pointsInLoop++;
                        
                        //all non-real points have already been removed, so the one left is the base
                        var pt1Base = pt1.neighbors[0].pt;
                            
                        var minBase = minPt.neighbors[0].pt;
                        
                        //now make a polygon with the connecting point
                        var pts = [pt1Base, pt1, minPt, minBase];
                        //we need to make a path from minPt to pt1 using only left, right, up, down
                        var currentPoint = minBase;
                        //MAKE POLYGON LOGIC
                        
                        if(currentPoint && pt1Base){
                            minPt.polygon = {};
                            minPt.polygon.pts = pts;
                        }
                    }else{
                        for(var j = 0; j < edges.length; j++){
                            if(edges[j].sourced === false){
                                nextPt = edges[j];
                                break;
                            }
                        }
                        nextPt.used = true;
                        loopStarter = nextPt;
                        pointsInLoop = 0;
                    }
                    ptsUsed++;
                    var percent = (100*ptsUsed / edges.length).toFixed(2);
                    displayCanvasMessage('cleaning edges... '+percent+'%');
                }
            }else{
                clearInterval(intervalId3);
                doneFunc();
            }
        },10)
    }else{
        doneFunc();
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
        for(var j = 0; j < animationVars.length; j++){
            scope[animationVars[j].name] = animationVars[j].value;
        }
        cX.eval(scope);
        cY.eval(scope);
        cZ.eval(scope);
        var point = {u:u,v:v,x:getRealPart(scope.x),y:getRealPart(scope.y),z:getRealPart(scope.z)};
        point.x = spreadCoord(point.x, domain.x.min, domain.x.max, domain.x.spread);
        point.y = spreadCoord(point.y, domain.y.min, domain.y.max, domain.y.spread);
        point.z = spreadCoord(point.z, domain.z.min, domain.z.max, domain.z.spread);
        point.neighbors = [];
        return point;
}

//cFunc should be compiled version of the function that's being bad
function isolateAsymptote(pt1, pt2, v, cFunc, cFunc2, cFunc3, iterations){
    if(iterations === 0){
        return [pt1,pt2];
    }
    //try first half, plus the epsilon in case it's exactly half
    var epsilon = {
        u:(pt2.u-pt1.u)/9e7,
        v:(pt2.v-pt2.v)/9e7
    }
    var p0 = {
        u:pt1.u,
        v:pt1.v
    }
    var p1 = {
        u:(pt2.u+pt1.u)/2-epsilon.u,
        v:(pt2.v+pt1.v)/2-epsilon.v
    }
    var p2 = {
        u:pt2.u,
        v:pt2.v
    };
    var scope = {
        v:[p1.v,p2.v], 
        u:[p1.u,p2.u]
    };
    for(var j = 0; j < animationVars.length; j++){
        scope[animationVars[j].name] = animationVars[j].value;
    }
    var resultInterval = cFunc.eval(scope);
    var resultInterval2 = cFunc2.eval(scope);
    var resultInterval3 = cFunc3.eval(scope);
    var newP1 = p0, newP2 = p1;
    if(resultInterval.hi !== Infinity && resultInterval.lo !== -Infinity
        && resultInterval2.hi !== Infinity && resultInterval2.lo !== -Infinity
        && resultInterval3.hi !== Infinity && resultInterval3.lo !== -Infinity){
        newP1 = p1;
        newP2 = p2;
    }
    return isolateAsymptote(newP1, newP2, v, cFunc,cFunc2, cFunc3, iterations - 1);
}

function uvDist(a,b){
    return Math.sqrt(Math.pow(a.u-b.u,2) + Math.pow(a.v-b.v,2));
}

function xyzDist(a,b){
    return Math.sqrt(Math.pow(a.x-b.x,2) + Math.pow(a.y-b.y,2) + Math.pow(a.z-b.z,2));
}

function isNonReal(pt){
    return pt===undefined || !pt || isNaN(pt.x) || isNaN(pt.y) || isNaN(pt.z) || pt.x === null || pt.y === null || pt.z === null;
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
    var inBetween = {x:getRealPart(scope.x),y:getRealPart(scope.y),z:getRealPart(scope.z)};
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

function makeFiniteIfInfinate(pt){
    if(pt.x == Number.POSITIVE_INFINITY){
        pt.x = domain.x.max * 2;
    }
    if(pt.y == Number.POSITIVE_INFINITY){
        pt.y = domain.y.max * 2;
    }
    if(pt.z == Number.POSITIVE_INFINITY){
        pt.z = domain.z.max * 2;
    }
    if(pt.x == Number.NEGATIVE_INFINITY){
        pt.x = domain.x.min * 2;
    }
    if(pt.y == Number.NEGATIVE_INFINITY){
        pt.y = domain.y.min * 2;
    }
    if(pt.z == Number.NEGATIVE_INFINITY){
        pt.z = domain.z.min * 2;
    }
}

function spreadCoord(val, min, max, spread){
    var center = (min+max)/2;
    var valRel = val - center;
    return valRel*spread + center;
}

function syncAxes(){
    axisEdge(axes[0]);
    axisEdge(axes[1]);
    axisEdge(axes[2]);
    
    var f = (domain.x.max - domain.x.min)/50;
    axes[0][0].x = domain.x.max;
    axes[0][1].x = domain.x.min;
    axes[0][2].x = domain.x.max + f;
    axes[0][3].x = domain.x.min - f;
    
    axes[1][0].y = domain.y.max;
    axes[1][1].y = domain.y.min;
    axes[1][2].y = domain.y.max + f;
    axes[1][3].y = domain.y.min - f;
    
    axes[2][0].z = domain.z.max;
    axes[2][1].z = domain.z.min;
    axes[2][2].z = domain.z.max + f;
    axes[2][3].z = domain.z.min - f;
    
    axes[0].dashed = false;
    axes[1].dashed = false;
    axes[2].dashed = false;
    
    if(domain.x.min > 0 || domain.x.max < 0){
        axes[1].dashed = true;
        axes[2].dashed = true;
    }
    if(domain.y.min > 0 || domain.y.max < 0){
        axes[0].dashed = true;
        axes[2].dashed = true;
    }
    if(domain.z.min > 0 || domain.z.max < 0){
        axes[0].dashed = true;
        axes[1].dashed = true;
    }
    
    if(!domain.center){
        domain.center = {x:(domain.x.max+domain.x.min)/2, y:(domain.y.max+domain.y.min)/2, z:(domain.z.max+domain.z.min)/2};
    }
    rotatePoints(axes[0], totalQuat);
    rotatePoints(axes[1], totalQuat);
    rotatePoints(axes[2], totalQuat);
}

function axisEdge(axis){
    var origin = {x:0,y:0,z:0};
    
    for(var k = 0 ; k < axis.length; k++){
        axis[k].x = domain.x.min > origin.x ? domain.x.min : domain.x.max < origin.x ? domain.x.max : origin.x;
        axis[k].y = domain.y.min > origin.y ? domain.y.min : domain.y.max < origin.y ? domain.y.max : origin.y;
        axis[k].z = domain.z.min > origin.z ? domain.z.min : domain.z.max < origin.z ? domain.z.max : origin.z;
    }
}

function syncQuats(){
    var q,p;
    pointQuats = []
    
    for(var v = 0; v < points.length; v++){
        q = pointToQuat(points[v]);
        q.neighbors = [];
        points[v].id = v;
        q.id = v;
        rotate(q, totalQuat);
        pointQuats.push(q);
    }
    for(var w = 0; w < points.length; w++){
        p = points[w];
        q = pointQuats[w];
        for(var k = 0; k < p.neighbors.length; k++){
            if(!pointQuats[p.neighbors[k].pt.id]){
                console.log(p)
                //throw new Error('point quat is null :(')
            }
            q.neighbors.push({
                draw: p.neighbors[k].draw,
                pt:pointQuats[p.neighbors[k].pt.id]
            });
        }
    }
    
}

function pointToQuat(p){
    return {w:0,x:p.x,y:p.y,z:p.z};
}

function sortPolygonsByZ(polygons){
    polygons.sort(function(a,b){
        if(a.averageVal.z > b.averageVal.z){
            return -1;
        }
        return 1;
    });
}

function plotPoints(){
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    
    if(graphingError === true){
        displayCanvasError()
        return;
    }
    
    ctx.fillStyle=domain.backgroundColor == 'dark' ? '#222222' : '#ffffff';
    if(onlyPlotNewPoints === false){
        ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    
    var strokeColor = domain.backgroundColor == 'dark' ? '#aaaaaa' : '#222222';
    
    ctx.strokeStyle = strokeColor;
    
    ctx.lineWidth = getLineWidth()
    
    ctx.setLineDash([])
    
    if(domain.coloring){
        for(var g = 0; g < polygons.length; g++){
            polygons[g].pts = [];
            for(var h = 0; h < polygons[g].indices.length; h++){
                polygons[g].pts.push(pointQuats[polygons[g].indices[h]]);
            }
            polygons[g].averageVal = averageValue(polygons[g].pts)
        }
        sortPolygonsByZ(polygons);
    }
    
    var width = canvas.width;
    var height = canvas.height;
    var xTranslate = (width - height)/2;
    if(xTranslate < 0){xTranslate = 0;}
    xTranslate += translation.x;
    var yTranslate = translation.y;
    
    var min = 0;
    if(onlyPlotNewPoints === true){
        min = pointQuats.length - pointsToPlot;
    }
    var k;
    ctx.beginPath();
    ctx.lineWidth = getLineWidth()
    if(domain.coloring){
        ctx.strokeStyle = strokeColor
    }else{
        for(k = min; k < pointQuats.length; k++){
            var point = pointQuats[k];
            var rPoint = transform(point.x, point.y, point.z, canvas);
            
            for(var h = 0; h < point.neighbors.length; h++){
                var n = point.neighbors[h];
                if(n.draw && n.pt){
                    var rPoint2 = transform(n.pt.x, n.pt.y, n.pt.z, canvas);
                    ctx.moveTo(rPoint.x + xTranslate, rPoint.y + yTranslate);
                    ctx.lineTo(rPoint2.x + xTranslate, rPoint2.y + yTranslate);
                }
            }
        }
        ctx.stroke();
    }
    
    if(domain.coloring){
        var time = (new Date()).getTime();
        var maxHue = domain.minHue/256;
        var minHue = domain.maxHue/256;
        var middle = (maxHue + minHue) / 2;
        for(k = 0; k < polygons.length; k++){
         
            var poly = polygons[k];
            if(poly.pts.length > 2){
                var polyVal = poly.averageVal;
                var realZ;
                var center=domain.center;
                rotate(polyVal, quatConj(totalQuat), center);
                var value;
                if(cartesian){
                    realZ = polyVal.z;
                    value = (realZ - domain.z.min) / (domain.z.max - domain.z.min) - .5;
                }
                if(spherical){
                    var dist = Math.sqrt(polyVal.x*polyVal.x + polyVal.y*polyVal.y + polyVal.z*polyVal.z);
                    value = dist / (domain.r.max) -.5;
                }
                if(cylindrical){
                    dist = Math.sqrt(polyVal.x*polyVal.x + polyVal.y*polyVal.y);
                    value = dist / domain.rho.max - .5;
                }
                
                //sigmoid function to bound color
                value = 2/(1+Math.pow(Math.E,-4*value))  - 1;
                
                dist = maxHue - middle;
                var hue = middle + value * dist;
                
                var normal = polyNormal(poly.pts[0],poly.pts[1],poly.pts[2]);
                
                var lightness = 0;
                var ql = domain.lightDirections.length
                for(var q = 0; q < ql; q++){
                    var angle = Math.min(angleBetween(normal, domain.lightDirections[q]), angleBetween(normal, scalar(-1,domain.lightDirections[q])));
                    lightness += domain.directionalLighting ? .65*Math.cos(angle)/ql+.35/ql : .74/ql;
                }
                
                var color = HSVtoRGB(hue, .5, lightness, 1);
                ctx.beginPath();
                ctx.lineWidth=1;
                ctx.fillStyle = 'rgba('+color.r+','+color.g+','+color.b+','+domain.opacity+')';
                ctx.strokeStyle = 'rgba('+color.r+','+color.g+','+color.b+','+domain.opacity+')';
                
                var origin = transform(poly.pts[0].x,poly.pts[0].y,poly.pts[0].z,canvas)
                if(origin){
                    ctx.moveTo(origin.x + xTranslate, origin.y + yTranslate)
                    for(var u = 1; u < poly.pts.length; u++){
                        if(!poly.pts[u]){break;}
                        var transformed = transform(poly.pts[u].x,poly.pts[u].y,poly.pts[u].z,canvas)
                        if(transformed){
                            ctx.lineTo(transformed.x + xTranslate, transformed.y + yTranslate);
                        }
                    }
                    ctx.lineTo(origin.x + xTranslate, origin.y + yTranslate)
                }
                
                ctx.fill();
                ctx.stroke();
                if(domain.showMeshWhileColoring){
                    ctx.strokeStyle = 'rgba(0,0,0,1)'
                    ctx.lineWidth = getLineWidth();
                    ctx.stroke();
                }
            }
        }
        var elapsed = (new Date()).getTime() - time;
        domain.coloringTime = elapsed;
    }
    
    if(domain.showAxes && onlyPlotNewPoints == false){
        var xAxisMax = transform(axes[0][0].x,axes[0][0].y,axes[0][0].z,canvas);
        var yAxisMax = transform(axes[1][0].x,axes[1][0].y,axes[1][0].z,canvas);
        var zAxisMax = transform(axes[2][0].x,axes[2][0].y,axes[2][0].z,canvas);
        var xAxisMin = transform(axes[0][1].x,axes[0][1].y,axes[0][1].z,canvas);
        var yAxisMin = transform(axes[1][1].x,axes[1][1].y,axes[1][1].z,canvas);
        var zAxisMin = transform(axes[2][1].x,axes[2][1].y,axes[2][1].z,canvas);
        
        var xMaxTitle = transform(axes[0][2].x,axes[0][2].y,axes[0][2].z,canvas);
        var xMinTitle = transform(axes[0][3].x,axes[0][3].y,axes[0][3].z,canvas);
        var yMaxTitle = transform(axes[1][2].x,axes[1][2].y,axes[1][2].z,canvas);
        var yMinTitle = transform(axes[1][3].x,axes[1][3].y,axes[1][3].z,canvas);
        var zMaxTitle = transform(axes[2][2].x,axes[2][2].y,axes[2][2].z,canvas);
        var zMinTitle = transform(axes[2][3].x,axes[2][3].y,axes[2][3].z,canvas);
        
        var axesColor = domain.backgroundColor == 'dark' ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.5)';
        
        ctx.strokeStyle = axesColor;
        ctx.lineWidth = .5;
        
        if(xAxisMax && xAxisMin){
            ctx.beginPath()
            if(axes[0].dashed){ctx.setLineDash([10,10]);}else{ctx.setLineDash([]);}
            ctx.moveTo(xAxisMin.x + xTranslate,xAxisMin.y + yTranslate);
            ctx.lineTo(xAxisMax.x + xTranslate,xAxisMax.y + yTranslate);
            ctx.stroke();
        }
        
        if(yAxisMax && yAxisMin){
            ctx.beginPath()
            if(axes[1].dashed){ctx.setLineDash([10,10]);}else{ctx.setLineDash([]);}
            ctx.moveTo(yAxisMin.x + xTranslate,yAxisMin.y + yTranslate);
            ctx.lineTo(yAxisMax.x + xTranslate,yAxisMax.y + yTranslate);
            ctx.stroke();
        }
        
        if(zAxisMax && zAxisMin){
            ctx.beginPath()
            if(axes[2].dashed){ctx.setLineDash([10,10]);}else{ctx.setLineDash([]);}
            ctx.moveTo(zAxisMin.x + xTranslate,zAxisMin.y + yTranslate);
            ctx.lineTo(zAxisMax.x + xTranslate,zAxisMax.y + yTranslate);
            ctx.stroke();
        }
        
        ctx.font = "15px Arial";
        ctx.fillStyle = axesColor;
        ctx.textAlign = 'center';
        var c = getRealDomainCenter()
        var w = getRealDomainWidth()
        if(xMaxTitle && xMinTitle){
            ctx.fillText('x: '+(c.x+w.x/2),xMaxTitle.x + xTranslate, xMaxTitle.y + yTranslate);
            ctx.fillText('x: '+(c.x-w.x/2),xMinTitle.x + xTranslate, xMinTitle.y + yTranslate);
        }
        if(yMaxTitle && yMinTitle){
            ctx.fillText('y: '+(c.y+w.y/2),yMaxTitle.x + xTranslate, yMaxTitle.y + yTranslate);
            ctx.fillText('y: '+(c.y-w.y/2),yMinTitle.x + xTranslate, yMinTitle.y + yTranslate);
        }
        if(zMaxTitle && zMinTitle){
            ctx.fillText('z: '+(c.z+w.z/2),zMaxTitle.x + xTranslate, zMaxTitle.y + yTranslate);
            ctx.fillText('z: '+(c.z-w.z/2),zMinTitle.x + xTranslate, zMinTitle.y + yTranslate);
        }
    }
}

function copyPoly(poly){
    var newPoly = {};
    newPoly.pts = [];
    for(var k = 0; k < poly.pts.length; k++){
        newPoly.pts.push({x: poly.pts[k].x, y: poly.pts[k].y, z: poly.pts[k].z});
    }
    return newPoly;
}

function getLineWidth(){
    var thickness = .3*math.sech(domain.density / 300);
    if(thickness < .002){
        thickness = .002;
    }
    return thickness;
}

function rotatePoints(pQuats, rot){
    for(var k = 0; k < pQuats.length; k++){
        rotate(pQuats[k],rot);
    }
}

function rotate(point,rotQuat, rotCenter){
    var center = rotCenter ? rotCenter : domain.center;
    var quat = {w:0,x:point.x-center.x,y:point.y-center.y,z:point.z-center.z}
    var quatOut = quatMult(quatMult(rotQuat,quat),quatConj(rotQuat));
    
    point.x=quatOut.x + center.x;
    point.y=quatOut.y + center.y;
    point.z=quatOut.z + center.z;
}

//check it out: http://www.cprogramming.com/tutorial/3d/quaternions.html
//remember that quaternions are not communative
function quatMult(q1,q2){
    return {
        w: q1.w*q2.w - q1.x*q2.x - q1.y*q2.y - q1.z*q2.z,
        x: q1.w*q2.x + q1.x*q2.w + q1.y*q2.z - q1.z*q2.y,
        y: q1.w*q2.y + q1.y*q2.w - q1.x*q2.z + q1.z*q2.x,
        z: q1.w*q2.z + q1.z*q2.w + q1.x*q2.y - q1.y*q2.x
    }
}

function quatScalar(q,n){
    return {
        w: q.w*n,
        x: q.x*n,
        y: q.y*n,
        z: q.z*n
    }
} 

function quatConj(q){
    return{
        w:q.w,
        x:-q.x,
        y:-q.y,
        z:-q.z
    };
}

function transform(x,y,z,canvas){
    //have some perspective, people!
    //a plane parallel to the z plane
    var imagePlaneZ = spreadCoord(domain.z.min, domain.z.min, domain.z.max, 1.6);
    var cameraZ = spreadCoord(domain.z.min, domain.z.min, domain.z.max, 3);
    var camera = {x: domain.center.x, y:domain.center.y, z:cameraZ};
    var fudge = 2;
    
    //need the line from point to camera
    if(domain.perspective === false){
        camera.z *= 9999999
        fudge = 1;
    }
    x = fudge*(x - camera.x) / (z - camera.z) * (imagePlaneZ - camera.z) + camera.x;
    y = fudge*(y - camera.y) / (z - camera.z) * (imagePlaneZ - camera.z) + camera.y;
    
    if(z < imagePlaneZ){
        return null;
    }
    
    var factor = Math.min(canvas.width, canvas.height);
    
    //switch the x and y axis to retain x cross y == z
    var realX = (x-domain.x.min)/(domain.x.max - domain.x.min)* factor;
    var realY = (y-domain.y.min)/(domain.y.max - domain.y.min)* factor;
    
    return {x:realX,y:realY};
}

function quatNorm(q){
    var mag = Math.sqrt(q.w*q.w+q.x*q.x+q.y*q.y+q.z*q.z);
    q.w /= mag;
    q.x /= mag;
    q.y /= mag;
    q.z /= mag;
    return q;
}

//stackoverflow for the win again! http://gamedev.stackexchange.com/questions/8191/any-reliable-polygon-normal-calculation-code
//  Modified from http://www.fullonsoftware.co.uk/snippets/content/Math_-_Calculating_Face_Normals.pdf
function polyNormal(p1, p2, p3){
    var v1 = sub(p2,p1);
    var v2 = sub(p3,p1);
    var surfaceNormal = {};
    surfaceNormal.x = (v1.y*v2.z) - (v1.z*v2.y);
    surfaceNormal.y = (v1.z*v2.x) - (v1.x*v2.z);
    surfaceNormal.z = (v1.x*v2.y) - (v1.y*v2.x);

    return surfaceNormal;
}

function angleBetween(v1, v2){
    var dotP = dot(v1,v2);
    var angle = Math.acos(dotP/(magnitude(v1)*magnitude(v2)));
    if(angle > Math.PI){
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

function magnitude(v){
    return Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z);
}

//stack overflow - Paul S. http://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately
function HSVtoRGB(h, s, v,a) {
    var r, g, b, i, f, p, q, t;
    if (h && s === undefined && v === undefined) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.floor(r * 255),
        g: Math.floor(g * 255),
        b: Math.floor(b * 255),
        a: a
    };
}