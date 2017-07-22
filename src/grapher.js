/*global MathQuill*/
/*global parseLatex*/
/*global characterizeExpression*/
/*global parseDomain*/
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
    percentCalculated:0,
    lightDirections:[{x:0,y:0,z:-1}],
    pointsOnly:false,
    pointWidthRatio:.005,
    animating:false,
    stopAnimating:true,
    showMeshWhileColoring:false,
    showAxesLabels:true,
    directionalLighting:true,
    perspective:true,
    backgroundColor:'dark',
    minHue:50,
    maxHue:170,
    opacity:1,
    fullscreen:false,
    rowLength:null,
    currentSystem:'cartesian',
    expressionInfo:null,
	maxColoringTime:0,
	normalMultiplier:1,
	polyNumber:0,
	polyData:[]
}

var compile = require('interval-arithmetic-eval');

var handleablePoints = 5000;
var xQuat = quatNorm({w:1,x:0,y:0,z:0});
var yQuat = quatNorm({w:1,x:0,y:0,z:0});
var cleanDensity = 15;

let webGLInfo = {
	initialized:false
};

var polygons = [];
var MQ;
var translation = {x:0,y:0};
var translateConst = .001;
var onlyPlotNewPoints = false;
var pointsToPlot = 0;

var unitQuat = {w:0,x:1,y:0,z:0};

var animationVars = [];
var animationImgs = [];

var skipDomain = false;

var intervalId, intervalId2, intervalId3, intervalId4, intervalId5;
var intervalFunctionSupported = true;

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

let graphWorkers = [];

var axes = [
	{x:1,y:0,z:0},
	{x:0,y:1,z:0},
	{x:0,y:0,z:1}
];

$(function(){
	// start a web worker to graph the function 
	initWebGL();
	
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
    $('#help-popup').click(function(event){})
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
    $('#animation-link').click(function(event){
        $('#settings-popup').addClass('hidden');
        $("#settings-content").unbind( 'click', document);
        $('#animate-popup').removeClass('hidden');
        $(document).mousedown(function (e){
            var container = $("#animate-content");
            if (!container.is(e.target) && container.has(e.target).length === 0){
                $('#animate-popup').addClass('hidden');
                $("#animate-content").unbind( 'click', document);
            }
        });
        event.preventDefault();
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
    
    $('#settings-icon').click(function(){
        $('#settings-popup').removeClass('hidden');
        $(document).mouseup(function (e){
            var container = $("#settings-content");
            if (!container.is(e.target) && container.has(e.target).length === 0){
                $('#settings-popup').addClass('hidden');
                $("#settings-content").unbind( 'click', document);
            }
        });
    });
	
	$('#invert-normal-icon').click(function(){
		domain.normalMultiplier *= -1;
		plotPointsWebGL();
	});
    
    MQ = MathQuill.getInterface(2);
    var autoCommands = 'pi theta rho phi sqrt sum';
    MQ.MathField($('#equation-input')[0],{
        spaceBehavesLikeTab: true,
        sumStartsWithNEquals: true,
        supSubsRequireOperand: true,
        autoCommands: autoCommands,
        //autoOperatorNames:'abs',
        handlers:{
            enter:function(mathField){
                graph();
            },
            edit:function(mathField){
                var result = characterizeExpression(parseLatex(mathField.latex(), animationVars));
                var outputString;
                if(parseLatex(mathField.latex(), animationVars).length === 0){
                    $('#notification-bar').css('color','var(--equation-font-color)');
                    outputString = 'enter expression'
                }else if(result.error !== 'none'){
                    outputString = result.error;
                    $('#notification-bar').css('color','rgb(255, 102, 102)');
                }else{
                    outputString = result.type
                    domain.currentSystem = result.type;
                    
                    if(result.message){
                        outputString += ': '+result.message;
                    }
                    outputString += ', '+(result.parametric ? 'parametric' : 'non-parametric')
                    $('#notification-bar').css('color','var(--equation-font-color)');
                    
                    if(result.parametric === true){
                        domain.currentSystem=result.type+'-parametric';
                    }else{
                        domain.currentSystem=result.type;
                    }
                    
                    domain.expressionInfo = result;
                    
                    setDomainVisibility();
                }
                
                $('#notification-bar').text(outputString);
            }
        }
    });
    
    var defaultValues = [
            'x,\\ y,\\ z\\in \\left[-10,10\\right]',
            '\\rho \\in \\left[0,10\\right],\\ \\ \\phi \\in \\left[0,2\\pi \\right],\\ \\ z\\in \\left[-10,10\\right]',
            'r\\in \\left[0,10\\right],\\ \\ \\theta \\in \\left[0,2\\pi \\right],\\ \\ \\phi \\in \\left[-\\frac{\\pi }{2},\\frac{\\pi }{2}\\right]',
            'u,\\ v\\in \\left[0,2\\pi \\right]'
        ]
    
    for(var k = 0; k < 4; k++){
        var el = $('#'+['cart','cyl','sphere','par'][k]+'-domain-bar')[0];
        MQ.MathField(el, {
            handlers:{
                enter: () => {graph();},
                edit: (field) => {
                    var latex = parseLatex(field.latex(), animationVars);
                    var result = parseDomain(latex);
                }
            },
            autoCommands: autoCommands+' in',
            supSubsRequireOperand: true
        });
    }
    
    //this seems to be a bug with mathquill. If I do any less than a second, I get weird artifacts 
    //above the brackets
    setTimeout(function(){
        for(k = 0; k < 4; k++){
            var el = $('#'+['cart','cyl','sphere','par'][k]+'-domain-bar')[0];
            MQ(el).latex(defaultValues[k])
        }
        setDomainVisibility();
    },1500)
    
    //randomGraph();
    // setTimeout(function(){
    //     var input = MQ.MathField($('#equation-input'));
    //     input.cmd(')');
    //     input.keystroke('Backspace')
    //     input.blur();
    // },500)
    domain.coloring = true;
    //graph();
    
    var mouseClicked = false;
    var leftMouseClicked = false;
    var mousePosition = {x:0,y:0};
    $('#canvas').mousemove(function(event){
        var deltaX,deltaY;
        if(!leftMouseClicked && mouseClicked){
            deltaX = event.clientX - mousePosition.x;
            deltaY = event.clientY - mousePosition.y;
            
            xQuat.y = -deltaX / 500;
            yQuat.x = -deltaY / 500;
            
            quatNorm(xQuat);
            quatNorm(yQuat);
            
            rotatePoints(axes, yQuat);
            rotatePoints(axes, xQuat);
            
            plotPointsWebGL()
        }
        if(leftMouseClicked){
			// possibly implement pan here
            plotPointsWebGL()
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
        if(domain.coloring && domain.coloringTime && domain.coloringTime > domain.maxColoringTime){
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
        plotPointsWebGL()
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
        
        if(domain.currentSystem.indexOf('cartesian') !== -1){
			
        }else if(domain.currentSystem.indexOf('spherical') !== -1){
            domain.r.min *= magnification;
            domain.r.max *= magnification;
        }else if(domain.currentSystem.indexOf('cylindrical') !== -1){
            domain.rho.min *= magnification;
            domain.rho.max *= magnification;
            min = domain.height.min;
            max = domain.height.max;
            domain.height.min = spreadCoord(min, min, max, magnification);
            domain.height.max = spreadCoord(max, min, max, magnification);
        }
        
        if(timeID){
            clearTimeout(timeID);
        }
        if(domain.coloringTime && domain.coloringTime > domain.maxColoringTime && domain.coloring){
            domain.wasColoring = true;
            domain.coloring = false;
        }
        plotPointsWebGL()
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
    plotPointsWebGL();
});

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

$('#axes-checkbox').change(function(){
    domain.showAxes = $('#axes-checkbox').prop('checked');
    plotPointsWebGL();
})

$('#color-checkbox').change(function(){
    domain.coloring = $('#color-checkbox').prop('checked');
    plotPointsWebGL();
})

$('#show-mesh-while-coloring-checkbox').change(function(){
    domain.showMeshWhileColoring = $('#show-mesh-while-coloring-checkbox').prop('checked');
    plotPointsWebGL();
})

$('#directional-lighting-checkbox').change(function(){
    domain.directionalLighting = $('#directional-lighting-checkbox').prop('checked');
    plotPointsWebGL();
})

$('#show-axes-labels-checkbox').change(function(){
    domain.showAxesLabels = $('#show-axes-labels-checkbox').prop('checked');
    plotPointsWebGL();
})

$('#perspective-checkbox').change(function(){
    domain.perspective = $('#perspective-checkbox').prop('checked');
    plotPointsWebGL();
});

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
    plotPointsWebGL();
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

function setDomainVisibility(){
    var toHide = [];
    //cart-domain-bar will never go away
    var toShow = [];
    if(domain.currentSystem.indexOf('cartesian') !== -1){
        toHide = ['cyl', 'sphere', 'par'];
    }
    if(domain.currentSystem.indexOf('cylindrical') !== -1){
        toHide = ['sphere', 'par'];
        toShow= ['cyl'];
    }
    if(domain.currentSystem.indexOf('spherical') !== -1){
        toHide = ['cyl','par'];
        toShow = ['sphere'];
    }
    
    if(domain.currentSystem.indexOf('parametric') !== -1){
        toShow = ['par'];
        toHide = ['cyl','sphere'];
    }
    
    toHide.forEach(x => $('#'+x+'-domain-bar').css('display','none'));
    toShow.forEach(x => $('#'+x+'-domain-bar').css('display','block'));
}

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
    // TODO: change domain inputs in domain bar
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

function evalDomain(string){
    var input = string;
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
        ['cart','cyl','sphere','par'].forEach(val => {
            var field = MQ($('#'+val+'-domain-bar')[0]);
            var latex = parseLatex(field.latex(), animationVars);
            var result = parseDomain(latex);
            result.forEach(val => {
                domain[val.varName].min = math.eval(val.range.min);
                domain[val.varName].max = math.eval(val.range.max);
            })
        })
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
    
    var density = parseInt($('#mesh-quality-input').val(),10);
    domain.density = density;
    
    //reset domain
    if(domain.pointsOnly === true){
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
                if(domain.currentSystem === 'cylindrical'){
                    realPoint = cylindricalToCartesian(x,y,z);
                    x = realPoint.x;
                    y = realPoint.y;
                    z = realPoint.z;
                }
                if(domain.currentSystem === 'spherical'){
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
                
            }
        }
        plotPointsWebGL();
        
    }else{
        var inputs = {
            x: '',
            y: '',
            z:''
        }
        var exp = domain.expressionInfo.expression;
        if(domain.currentSystem.indexOf('parametric') !== -1){
            //by convention, the entire body is stored in the xFunc
            //unfortunately, parametric cylindrical and spherical systems will need a little post processing (see plot),
            // since it's relatively impossible to pick apart components before the evalutation.
            inputs.x = exp.body;
            //dummy input to prevent math.js from complaining
            inputs.y = 'x';
            inputs.z = 'x';
        }
        else if(domain.currentSystem.indexOf('cartesian') !== -1){
            var realCenter = getRealDomainCenter();
            var realWidth = getRealDomainWidth();
            
            inputs[exp.vars[0]] = exp.body;
            
            var otherVars = ['x','y','z'].filter(x => x !== exp.vars[0]);
            
            inputs[otherVars[0]] = 'u';
            inputs[otherVars[1]] = 'v';
            
            domain.u.max = realCenter[otherVars[0]] + realWidth[otherVars[0]]/2
            domain.u.min = realCenter[otherVars[0]] - realWidth[otherVars[0]]/2
            
            domain.v.max = realCenter[otherVars[1]] + realWidth[otherVars[1]]/2
            domain.v.min = realCenter[otherVars[1]] - realWidth[otherVars[1]]/2
        }else if(domain.currentSystem.indexOf('cylindrical') !== -1 || domain.currentSystem.indexOf('spherical') !== -1){
            var cyl = domain.currentSystem.indexOf('cylindrical') !== -1;
            var cylInputs = cyl ? {rho:'', phi:'', z:''} : {r:'', theta:'', phi:''};
            cylInputs[exp.vars[0]] = exp.body;
            
            var otherVars = (cyl ? ['rho','phi','z'] : ['r','theta','phi']).filter(x => x !== exp.vars[0]);
            
            cylInputs[otherVars[0]] = 'u';
            cylInputs[otherVars[1]] = 'v';
            
            domain.u.min = domain[otherVars[0]].min
            domain.u.max = domain[otherVars[0]].max
            
            domain.v.min = domain[otherVars[1]].min
            domain.v.max = domain[otherVars[1]].max
            
            for(var i = 0; i < 2; i++){
                var regex = new RegExp('\\('+otherVars[i]+'\\)','g');
                cylInputs[exp.vars[0]] = cylInputs[exp.vars[0]].replace(regex, ['(u)','(v)'][i]);
            }
            
            if(cyl){
                inputs.x = '('+cylInputs.rho+')*cos('+cylInputs.phi+')';
                inputs.y = '('+cylInputs.rho+')*sin('+cylInputs.phi+')';
                inputs.z = cylInputs.z;
            }else{
                inputs.x = '('+cylInputs.r+')*cos('+cylInputs.theta+')*cos('+cylInputs.phi+')';
                inputs.y = '('+cylInputs.r+')*sin('+cylInputs.theta+')*cos('+cylInputs.phi+')';
                inputs.z = '('+cylInputs.r+')*sin('+cylInputs.phi+')';
            }
            
            console.log(inputs)
        }
        
		
		graphParametricFunction(inputs.x, inputs.y, inputs.z, spread, onFinish);
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

function graphParametricFunction(xFunc, yFunc, zFunc, spread, onFinish){    
	// give our webworker(s) some work to do 
	domain.polyData = [];
	domain.polyNumber = 0;
	updateBuffer([]);
	
	let lastUpdateTime = Date.now();
	
	// 3 cores is a pretty good guess for a modern computer... maybe? (average of 2 and 4?)
	let workerIndex = 0;
	while(graphWorkers.length < (navigator.hardwareConcurrency - 1 | 2)){
		console.log('creating worker '+workerIndex);
		// create a worker
		graphWorkers.push({
			worker: new Worker('mesh.js'),
			idle: true,
			index: workerIndex,
			subdivisionIndex:null
		});
		workerIndex++;
	}
	
	// the domain will be divided into 16 zones, each a square
	let subdivisions = [];
	let subSideCount = 3;
	
	let uGap = (domain.u.max - domain.u.min) / subSideCount;
	let vGap = (domain.v.max - domain.v.min) / subSideCount;
	let subdivisionCount = 0;
	
	for(let x = 0; x < subSideCount; x++){
		for(let y = 0; y < subSideCount; y++){
			subdivisions.push({
				completed:false,
				// if a worker is currently working on it
				tagged:false,
				index:subdivisionCount,
				region:{
					u:{
						min: domain.u.min + x * uGap,
						max: domain.u.min + (x + 1) * uGap
					},
					v:{
						min: domain.v.min + y * vGap,
						max: domain.v.min + (y + 1) * vGap
					}
				}
			});
			subdivisionCount++;
			
			// create a spot for the polyData 
			domain.polyData.push([]);
		}
	}
	
	// while there are still regions to finish, assign idle workers to regions
	let onIdleWorker = graphWorker => {
		// find the next not-completed subdivision 
		let subIndex = -1;
		let allCompleted = true;
		for(let i = 0; i < subdivisions.length; i++){
			if(subdivisions[i].tagged === false){
				subIndex = i;
				allCompleted = false;
				break;
			}else if(subdivisions[i].completed === false){
				allCompleted = false;
			}
		}
		
		if(allCompleted === true){
			// all sections have been completed
			console.log('mesh complete');
			graphWorker.worker.terminate();
			graphWorkers = [];
			
			updateBuffer(domain.polyData);
			plotPointsWebGL();
			
			onFinish();
		}else if(subIndex === -1){
			// nothing more for this web worker to do, terminate it
			graphWorker.worker.terminate();
			graphWorkers.splice(graphWorker.index, 1);
		}else{
			// assign the worker to the subdivision 
			let workerSubdivision = subdivisions[subIndex];
			
			// copy domain to change it for the worker
			let workerDomain = JSON.parse(JSON.stringify(domain));
			workerDomain.u = workerSubdivision.region.u;
			workerDomain.v = workerSubdivision.region.v;
			
			graphWorker.subdivisionIndex = workerSubdivision.index;
			workerSubdivision.tagged = true;
			
			console.log('worker '+graphWorker.index+' has been assigned');
			
			// trigger the worker
			graphWorker.worker.postMessage(['GRAPH', xFunc, yFunc, zFunc, workerDomain]);
			
			// handle responses
			graphWorker.worker.onmessage = function(e){
				let [responseType, ...args] = e.data;
				if(responseType === 'POLYGON_UPDATE'){
					// draw the updates
					// expected args: [polydata, polygons.length]
					domain.polyData[graphWorker.subdivisionIndex] = domain.polyData[graphWorker.subdivisionIndex].concat(args[0]);
					
					// since there are many webworkers about, there will be at least one update every 500ms, 
					// (or however long it is), but probably many more. Thus we'll time actual redraws ourselves
					if(Date.now() - lastUpdateTime > 1000){
						updateBuffer(domain.polyData);
						plotPointsWebGL();
						lastUpdateTime = Date.now();
					}
					
				}else if(responseType === 'FINISHED'){
					console.log('worker '+graphWorker.index+' has finished');
					
					domain.polyData[graphWorker.subdivisionIndex] = args[0];
					updateBuffer(domain.polyData);
					
					workerSubdivision.completed = true;
					
					// reassign this worker
					onIdleWorker(graphWorker);
				}
			}
		}
	}
	
	// all of the workers are initially idle
	for(let graphWorker of graphWorkers){
		onIdleWorker(graphWorker);
	}
}

function displayCanvasError(){
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0,0, width, height);
    
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.3)'
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

function getRealPart(val){
    return val.im ? undefined : val;
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

function isNonReal(pt){
    return pt===undefined || !pt || isNaN(pt.x) || isNaN(pt.y) || isNaN(pt.z) || pt.x === null || pt.y === null || pt.z === null;
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

function pointToQuat(p){
    return {w:0,x:p.x,y:p.y,z:p.z};
}

// assumes that all points and polygons have been created
function initWebGL(){
	console.log('initializing webgl...');
	let gl = document.getElementById('canvas').getContext('webgl');
	
	if(!gl){
		alert('Your browser does not support webgl. I\'m really not sure what browser you could possibly be using, but I suggest you update, or better yet, download Chrome.');
		return;
	}
	
	// create vertex shader
	let vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, document.getElementById('vertex-shader').text);
	gl.compileShader(vertexShader);
	
	console.log(gl.getShaderInfoLog(vertexShader));
	
	// create fragment shader
	let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, document.getElementById('fragment-shader').text);
	gl.compileShader(fragmentShader);
	
	console.log(gl.getShaderInfoLog(fragmentShader));
	
	// create our program
	let program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	
	console.log(gl.getProgramInfoLog(program));
	
	// get attribute/uniform locations
	webGLInfo.positionLocation = gl.getAttribLocation(program, 'a_position');
	webGLInfo.normalLocation = gl.getAttribLocation(program, 'a_normal');
	webGLInfo.bariLocation = gl.getAttribLocation(program, 'a_bari_coord');
	
	webGLInfo.orientationXLocation = gl.getUniformLocation(program, 'u_orientation_x');
	webGLInfo.orientationYLocation = gl.getUniformLocation(program, 'u_orientation_y');
	webGLInfo.orientationZLocation = gl.getUniformLocation(program, 'u_orientation_z');
	webGLInfo.domainCenterLocation = gl.getUniformLocation(program, 'u_domain_center');
	webGLInfo.aspectRatioLocation = gl.getUniformLocation(program, 'u_aspect_ratio');
	webGLInfo.domainHalfWidthLocation = gl.getUniformLocation(program, 'u_domain_halfwidth');
	webGLInfo.transparencyLocation = gl.getUniformLocation(program, 'u_transparency');
	webGLInfo.borderLocation = gl.getUniformLocation(program, 'u_draw_borders');
	webGLInfo.perspectiveLocation = gl.getUniformLocation(program, 'u_perspective');
	webGLInfo.directionalLightingLocation = gl.getUniformLocation(program, 'u_directional_lighting');
	webGLInfo.normalMultiplierLocation = gl.getUniformLocation(program, 'u_normal_multiplier');
	
	// make our buffer
	let buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	
	// put the data in polygons into an array
	let polyData = [];
	
	// put the data into the buffer
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(polyData), gl.STATIC_DRAW);
	
	webGLInfo.gl = gl;
	webGLInfo.program = program;
	webGLInfo.initialized = true;
}

function updateBuffer(polyDatas){
	let polyData = [];
	for(let polyD of polyDatas){
		polyData = polyData.concat(polyD);
	}
	
	// 3 for position, 3 for normal, 3 for barimetric data, per each point (of which 
	// there are 3 per triangle)
	domain.polyNumber = polyData.length / 27;
	
	let gl = webGLInfo.gl;
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(polyData), gl.STATIC_DRAW);
}

function plotPointsWebGL(){
	if(!webGLInfo.initialized){
		return;
	}
	
	gl = webGLInfo.gl;
	
	// set the viewport
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	
	// clear canvas
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	
	gl.useProgram(webGLInfo.program);
	
	// location, size, type, normalize, stride, offset
	gl.vertexAttribPointer(webGLInfo.positionLocation, 3, gl.FLOAT, false, 36, 0);
	gl.enableVertexAttribArray(webGLInfo.positionLocation);
	
	gl.vertexAttribPointer(webGLInfo.normalLocation, 3, gl.FLOAT, false, 36, 12);
	gl.enableVertexAttribArray(webGLInfo.normalLocation);
	
	gl.vertexAttribPointer(webGLInfo.bariLocation, 3, gl.FLOAT, false, 36, 24);
	gl.enableVertexAttribArray(webGLInfo.bariLocation);
	
	// set uniforms
	gl.uniform3fv(webGLInfo.orientationXLocation, [axes[0].x, axes[0].y, axes[0].z]);
	gl.uniform3fv(webGLInfo.orientationYLocation, [axes[1].x, axes[1].y, axes[1].z]);
	gl.uniform3fv(webGLInfo.orientationZLocation, [axes[2].x, axes[2].y, axes[2].z]);
	
	gl.uniform3fv(webGLInfo.domainCenterLocation, [(domain.x.max+domain.x.min)/2, (domain.y.max+domain.y.min)/2, (domain.z.max+domain.z.min)/2]);
	gl.uniform1f(webGLInfo.domainHalfWidthLocation, (domain.x.max - domain.x.min) / 2);
	gl.uniform1f(webGLInfo.aspectRatioLocation, canvas.width / canvas.height);
	
	let transparency = domain.coloring ? 1 : 0;
	let showBorder = !domain.coloring || domain.showMeshWhileColoring;
	
	if(domain.coloring){
		gl.disable(gl.BLEND);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
	}else{
		gl.disable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	}
	
	gl.uniform1f(webGLInfo.transparencyLocation, transparency);
	gl.uniform1f(webGLInfo.borderLocation, showBorder);
	
	gl.uniform1f(webGLInfo.perspectiveLocation, domain.perspective ? 1 : -1);
	gl.uniform1f(webGLInfo.directionalLightingLocation, domain.directionalLighting ? 1 : -1);
	
	gl.uniform1f(webGLInfo.normalMultiplierLocation, domain.normalMultiplier);
	
	// primitive type, offset, count
	gl.drawArrays(gl.TRIANGLES, 0, domain.polyNumber * 3);
}

function rotatePoints(pQuats, rot){
    for(var k = 0; k < pQuats.length; k++){
        rotate(pQuats[k],rot);
    }
}

function rotate(point,rotQuat, rotCenter){
    const center = rotCenter ? rotCenter : domain.center;
    const quat = {w:0,x:point.x-center.x,y:point.y-center.y,z:point.z-center.z}
	
	// rotate the point
    const quatOut = quatMult(quatMult(rotQuat,quat),quatConj(rotQuat));
    
    point.x=quatOut.x + center.x;
    point.y=quatOut.y + center.y;
    point.z=quatOut.z + center.z;
	
	if(!point.neighbors){
		return;
	}
	
	// now rotate all the control points of its neighbors
	for(let n of point.neighbors){
		const q = {
			w: 0,
			x: n.controlPt.x - center.x,
			y: n.controlPt.y - center.y,
			z: n.controlPt.z - center.z
		};
		
		const result = quatMult(quatMult(rotQuat, q), quatConj(rotQuat));
		
		n.controlPt.x = result.x + center.x;
		n.controlPt.y = result.y + center.y;
		n.controlPt.z = result.z + center.z;
	}
}

// check it out: http://www.cprogramming.com/tutorial/3d/quaternions.html
// remember that quaternions are not communative
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

function quatNorm(q){
    var mag = Math.sqrt(q.w*q.w+q.x*q.x+q.y*q.y+q.z*q.z);
    q.w /= mag;
    q.x /= mag;
    q.y /= mag;
    q.z /= mag;
    return q;
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




