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
    pointsOnly:false,
    pointWidthRatio:.005,
    animating:false,
    stopAnimating:true,
    showMeshWhileColoring:false,
	showAxes:true,
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
	normalMultiplier:-1,
	polyNumber:0,
	polyData:[],
	axisPrecision:2,
	miniDisplay:false,
	transparency:1,
	shininess:150,
	spreadCenter:{x:0,y:0,z:0}
}

let defaultDomain = {};
let transparencyBuffer = [];

// for multiple functions. domain refers to the
// current plot in question
let domains = [];
let globalExtrema = {
	x:{min:-10,max:10},
	y:{min:-10,max:10},
	z:{min:-10,max:10}
};
let globalViewPoint = {
	x:{min:-10,max:10},
	y:{min:-10,max:10},
	z:{min:-10,max:10},
	center:{x:0,y:0,z:0}
};

var xQuat = quatNorm({w:1,x:0,y:0,z:0});
var yQuat = quatNorm({w:1,x:0,y:0,z:0});

let webGLInfo = {
	initialized:false
};

var MQ;

var animationVars = [];
var animationImgs = [];

var skipDomain = false;

var graphingError = false;

let graphWorkersPool = [[]];
let graphID = 0;

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
	$('#text-canvas').prop('width',width);
	$('#text-canvas').prop('height',height);

  $('#u-v-range-row').hide();

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
      $(document).mousedown(function (e){
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

	$('#recenter-button').click(function(){
		for(let a of ['x','y','z']){
			for(let b of ['min','max']){
				globalViewPoint[a][b] = globalExtrema[a][b];
			}
		}
		globalViewPoint.center = {
			x: (globalViewPoint.x.min+globalViewPoint.x.max)/2,
			y: (globalViewPoint.y.min+globalViewPoint.y.max)/2,
			z: (globalViewPoint.z.min+globalViewPoint.z.max)/2
		}

		plotPointsWebGL();
	});

	$('.global-help-link').click(function(){
		// hide settings
		$('#settings-popup').addClass('hidden');
        $("#settings-content").unbind( 'click', document);

		// open help menu
		$('#help-icon').click();

		// scroll to faq question
		document.getElementById('global-faq').scrollIntoView();
	});

	$('.mesh-color-option').click(e => {
		for(let el of [...document.getElementsByClassName('mesh-color-option')]){
			el.classList.remove('mesh-color-option-selected');
		}
		e.target.classList.add('mesh-color-option-selected');
		let colorText = e.target.style.backgroundColor;
		let rgb = colorText.split(',').map(x=>parseInt(x.replace(/\D/g,'')));
		domain.color = rgbToHsl(...rgb)[0];
		domain.colorString = colorText;

		// since color (hue) is an attribute, update the buffer
		updateBuffer(domain.polyData, domain.polySkipData, domain.lineData, domain);

		plotPointsWebGL();
	});
	let colorTxt = document.getElementsByClassName('mesh-color-option-selected')[0].style.backgroundColor;
	let rgb = colorTxt.split(',').map(x=>parseInt(x.replace(/\D/g,'')));
	domain.color = rgbToHsl(...rgb)[0];
	domain.colorString = colorTxt;

    MQ = MathQuill.getInterface(2);
    var autoCommands = 'pi theta rho phi sqrt sum';
    MQ.MathField($('#equation-input')[0],{
        spaceBehavesLikeTab: true,
        sumStartsWithNEquals: true,
        supSubsRequireOperand: true,
        autoCommands: autoCommands,
        autoOperatorNames:'abs acos acosh acot acoth acsc acsch add asec asech asin asinh atan '+
							'atanh bellNumbers bitAnd bitNot bitOr bitXor catalan cbrt ceil '+
							'combinations complex composition concat conj cos cosh cot coth cross csc csch det distance dot dotDivide '+
							'dotMultiply dotPow exp factorial fix floor gamma gcd hypot im inv kldivergence lcm leftShift log max mean median min mod '+
							'mode nthRoot re rightArithShift rightLogShift round sec sech sign sin sinh sqrt std tan tanh trace transpose var',
        handlers:{
            enter:function(mathField){
                graphAll();
            },
            edit:function(mathField){
				domain.expressionLatex = mathField.latex();
                var result = characterizeExpression(parseLatex(mathField.latex(), animationVars));
                var outputString;
                if(parseLatex(mathField.latex(), animationVars).length === 0){
                    $('#notification-bar').css('color','var(--equation-font-color)');
                    outputString = ''
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

					if(domain.currentSystem === 'spherical-parametric'){
						domain.expressionInfo.expression.vars = domain.expressionInfo.expression.vars.map(x => x === 'phi' ? 'sphi' : x);
					}
					if(domain.currentSystem === 'cylindrical-parametric'){
						domain.expressionInfo.expression.vars = domain.expressionInfo.expression.vars.map(x => x === 'z' ? 'height' : x);
					}

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
        ];

	for(let i = 0; i < 4; i++){
		domain[['cartesian','cylindrical','spherical','parametric'][i]+'DomainLatex'] = defaultValues[i];
	}
	domain.expressionLatex = '';

    for(var k = 0; k < 4; k++){
        var el = $('#'+['cart','cyl','sphere','par'][k]+'-domain-bar')[0];
        (i=>{
			MQ.MathField(el, {
				handlers:{
					enter: () => {graphAll();},
					edit: (field) => {
						domain[['cartesian','cylindrical','spherical','parametric'][i]+'DomainLatex'] = field.latex();
						var latex = parseLatex(field.latex(), animationVars);
						var result = parseDomain(latex);
					}
				},
				autoCommands: autoCommands+' in',
				supSubsRequireOperand: true
			});
		})(k);
    }

    //this seems to be a bug with mathquill. If I do any less than a second, I get weird artifacts
    //above the brackets
    setTimeout(function(){
        for(k = 0; k < 4; k++){
            var el = $('#'+['cart','cyl','sphere','par'][k]+'-domain-bar')[0];
            MQ(el).latex(defaultValues[k])
        }
        // set a default function so that a first time visitor can see something pretty
        MQ($('#equation-input')[0]).latex('z=\\frac{48}{16+x^2+y^2}\\cos \\left(\\sqrt{x^2+y^2}\\right)');
        setDomainVisibility();
		    readURLParameters();
    },1500)

    domain.coloring = true;

    var mouseClicked = false;
    var leftMouseClicked = false;
    var mousePosition = {x:0,y:0};
    $('#text-canvas').mousemove(function(event){
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

			// normalize axes to prevent drift
			[0,1,2].forEach(x => {
				axes[x] = scalar(1/magnitude(axes[x]), axes[x]);
			});

            plotPointsWebGL()
        }
        if(leftMouseClicked){
			// pan algorithm here
			// just translate the domain by the inverseclipspace-ed mouse delta vector
			deltaX = event.clientX - mousePosition.x;
            deltaY = event.clientY - mousePosition.y;

			let canvas = document.getElementById('canvas');
			// convert to clipspace
			deltaX = -2 * deltaX / canvas.width;
			deltaY = 2 * deltaY / canvas.height;

			let clipCenter = simulateWebGLClipspace(globalViewPoint.center).clipspace;
			let translate1 = inverseClipspace({
				x: deltaX + clipCenter.x,
				y: clipCenter.y,
				z: clipCenter.z
			});
			let translate2 = inverseClipspace({
				x: clipCenter.x,
				y: deltaY + clipCenter.y,
				z: clipCenter.z
			});

			translate1 = sub(translate1, globalViewPoint.center);
			translate2 = sub(translate2, globalViewPoint.center);

			for(let domainDim of ['x','y','z']){
				for(let ext of ['min','max']){
					globalViewPoint[domainDim][ext] += translate1[domainDim] + translate2[domainDim];
				}
			}
			globalViewPoint.center = add(globalViewPoint.center, translate1);
			globalViewPoint.center = add(globalViewPoint.center, translate2);

			if(magnitude(translate1) !== 0 || magnitude(translate2) !== 0){
				activateReplotAtZoomPopup();
			}

            plotPointsWebGL()
        }
        mousePosition = {x:event.clientX,y:event.clientY};
    })
    $('#text-canvas').mousedown(function(event){
        mouseClicked = false;
        leftMouseClicked = false;
        if(event.which === 1){
            mouseClicked = true;
        }else if(event.which === 3){
            leftMouseClicked = true;
        }
        mousePosition = {x:event.clientX,y:event.clientY};
        if(domain.coloring && domain.coloringTime && domain.coloringTime > domain.maxColoringTime){
            domain.wasColoring = true;
            domain.coloring = false;
        }else{
            domain.wasColoring = false;
        }
    })
    $('#text-canvas').mouseup(function(e){
        mouseClicked = false;
        if(leftMouseClicked){

        }
        if(domain.wasColoring){
            domain.coloring = true;
        }
        plotPointsWebGL()
        leftMouseClicked = false;
    })
    var timeID;
    $('#text-canvas').bind('mousewheel', function(e){
        var magnification = 1;
        if(e.originalEvent.wheelDelta > 0){
            magnification = .9;
        }else{
            magnification = 1/.9;
        }

		let mouseX = e.clientX,
			mouseY = e.clientY;

		// the idea is to send a ray from the camera through the cursor.
		// The midpoint between the intersection points of the domain faces
		// is where the center of magnification is

		// use simulateWebGLClipspace to find the camera position
		// the center line (a dot in the middle of the screen, L(t) = t (0,0,1) ) passes through the camera,

		// for our test points, we want to avoid when b === 0 || c === 0
		// so we'll use 4 corners and screen out the ones that are too close

		// the projection plane is simply the z value such that the
		// w coordinate is 1. Below (in simulateWebGLTranform), w is defined
		// as domain.perspective ? (clipspace.z + 1.0) / 2.0 + 0.10 : .6;
		// so (z + 1.0) / 2.0 + .1 == 1, z = .8

		let projZ = .8;

		// the camera is where w is 0
		// (z + 1)/2 + .1 == 0, z = -1.2
		let camera = {
			x: 0,
			y: 0,
			z: -1.2
		};

		// now find the cursor position
		let canvas = document.getElementById('canvas');
		let cursor = {
			x: (mouseX / canvas.width) * 2 - 1,
			y: ((canvas.height - mouseY) / canvas.height) * 2 - 1,
			z: projZ
		}

		// now we have a ray, L(t) = camera + t (cursor - camera)
		// find the intersection with all the domain edge planes (there should be 2),
		// find the midpoint of these and make that the stationary point

		let xmax = globalViewPoint.x.max,
			xmin = globalViewPoint.x.min,
			ymax = globalViewPoint.y.max,
			ymin = globalViewPoint.y.min,
			zmax = globalViewPoint.z.max,
			zmin = globalViewPoint.x.max;
		if(globalExtrema.x){
			xmax = globalExtrema.x.max,
			xmin = globalExtrema.x.min,
			ymax = globalExtrema.y.max,
			ymin = globalExtrema.y.min,
			zmax = globalExtrema.z.max,
			zmin = globalExtrema.z.min
		}

		// 6 faces => 6 polygon plane definitions with 4 points each
		let planes = [
			[{x:xmin,y:ymin,z:zmin},{x:xmin,y:ymax,z:zmin},{x:xmax,y:ymax,z:zmin},{x:xmax,y:ymin,z:zmin}],
			[{x:xmin,y:ymin,z:zmin},{x:xmin,y:ymin,z:zmax},{x:xmax,y:ymin,z:zmax},{x:xmax,y:ymin,z:zmin}],
			[{x:xmin,y:ymin,z:zmin},{x:xmin,y:ymax,z:zmin},{x:xmin,y:ymax,z:zmax},{x:xmin,y:ymin,z:zmax}],

			[{x:xmax,y:ymax,z:zmax},{x:xmax,y:ymin,z:zmax},{x:xmin,y:ymin,z:zmax},{x:xmin,y:ymax,z:zmax}],
			[{x:xmax,y:ymax,z:zmax},{x:xmax,y:ymax,z:zmin},{x:xmin,y:ymax,z:zmin},{x:xmin,y:ymax,z:zmax}],
			[{x:xmax,y:ymax,z:zmax},{x:xmax,y:ymin,z:zmax},{x:xmax,y:ymin,z:zmin},{x:xmax,y:ymax,z:zmin}]
		];

		planes = planes.map(x => x.map(i => simulateWebGLClipspace(i).clipspace));

		let intersections = planes.map(x => linePolyIntersection(x, camera, cursor));
		intersections = intersections.filter(x => x !== null);

		// find midpoint of first 2 intersections
		let stationaryPt = null;
		if(intersections.length >= 2){
			stationaryPt = scalar(.5, add(intersections[0], intersections[1]));
			// convert this back from clipspace
			stationaryPt = inverseClipspace(stationaryPt);
		}else{
			stationaryPt = globalViewPoint.center;
		}

		// we need to transform the domain such that stationaryPt doesn't move under transformation
		// this is essentially a scaling with stationaryPt as the origin
		for(let domainDim of ['x','y','z']){
			for(let ext of ['min','max']){
				globalViewPoint[domainDim][ext] = (globalViewPoint[domainDim][ext] - stationaryPt[domainDim]) * magnification + stationaryPt[domainDim];
			}
		}

		// reset domain center
		globalViewPoint.center = {
			x: (globalViewPoint.x.min + globalViewPoint.x.max)/2,
			y: (globalViewPoint.y.min + globalViewPoint.y.max)/2,
			z: (globalViewPoint.z.min + globalViewPoint.z.max)/2
		};

        plotPointsWebGL();

		// get the 'replot at zoom' popup out
		activateReplotAtZoomPopup();

    })
    document.getElementById('text-canvas').oncontextmenu = function(e){
        return false;
    }

	tabBehavior();

	domain.center = getRealDomainCenter();
	plotPointsWebGL();

	// finally, load images (so they don't hang the interface)
	$('img').each(function(){
		if($(this)[0].hasAttribute('tsrc')){
			$(this).attr('src', $(this).attr('tsrc'));
		}
	});
});

function tabBehavior(){
	defaultDomain = JSON.parse(JSON.stringify(domain));
	domains = [domain];

	let newTabButton = document.getElementById('add-tab-button');
	newTabButton.onclick = function(){
		let newEl = document.createElement('div');
		newEl.classList.add('tab');

		let closeImg = document.createElement('img');
		closeImg.src='../imgs/close-icon.svg';
		closeImg.classList.add('tab-close-button');

		newEl.appendChild(closeImg);

		document.getElementById('tabs-wrapper').insertBefore(newEl, newTabButton);

		// push a new default domain to domains
		let newDomain = JSON.parse(JSON.stringify(defaultDomain));
		// copy global settings over
		newDomain.perspective = domain.perspective;
		newDomain.directionalLighting = domain.directionalLighting;
		newDomain.showAxes = domain.showAxes;
		newDomain.showAxesLabels = domain.showAxesLabels;

		domains.push(newDomain);

		updateGUIOnDomainSwitch();

		updateTabClicks();

		newEl.onclick();
	}
	updateTabClicks();
}

function updateTabClicks(){
	let tabs = document.getElementsByClassName('tab');
	let c = 0;
	for(let a of [...tabs]){
		((tab, domainIndex) => {
			tab.onclick = function(){
				for(let t of [...tabs]){
					t.classList.remove('selected');
				}
				tab.classList.add('selected');

				domain = domains[domainIndex];

				updateGUIOnDomainSwitch();
			};
			// image on click
			if(domainIndex > 0){
				tab.children[0].onclick = function(e){
					// select previous tab, remove domain, then remove tab
					if(tab.classList.contains('selected')){
						tabs[domainIndex - 1].onclick();

						domain = domains[domainIndex - 1];
					}

					domains.splice(domainIndex, 1);

					tab.parentElement.removeChild(tab);

					updateGUIOnDomainSwitch();
					updateTabClicks();
					e.stopPropagation();
					return false;
				}
			}
		})(a,c);
		c++;
	}
}

function updateGUIOnDomainSwitch(){
	// domain items
	for(let i = 0; i < 4; i++){
		// ugly, but effective
		MQ($('#'+['cart','cyl','sphere','par'][i]+'-domain-bar')[0]).latex(domain[['cartesian','cylindrical','spherical','parametric'][i]+'DomainLatex']);
	}

	// expression
	MQ(document.getElementById('equation-input')).latex(domain.expressionLatex);

	// mutable options
	//   shade mesh
	//   render mesh when shading
	//   ignore normal
	//   opacity
	//   mesh quality
	//   color
	//   shininess
	document.getElementById('show-mesh-while-coloring-checkbox').checked = domain.showMeshWhileColoring;
	document.getElementById('ignore-normal-checkbox').checked = domain.ignoreNormal;
	document.getElementById('invert-normal-button').style.opacity = domain.ignoreNormal ? .2 : 1;
	document.getElementById('transparency-input').value = domain.transparency+'';
	document.getElementById('shininess-input').value = domain.shininess+'';
	document.getElementById('mesh-quality-input').value = domain.density;
	for(let i of [...document.getElementsByClassName('mesh-color-option')]){
		i.classList.remove('mesh-color-option-selected');
	}
	[...document.getElementsByClassName('mesh-color-option')].filter(x => x.style.backgroundColor === domain.colorString)[0].classList.add('mesh-color-option-selected');
}

function activateReplotAtZoomPopup(){
	document.getElementById('replot-at-zoom-popup').classList.remove('graphing-progress-hidden');
	document.getElementById('replot-at-zoom-button').onclick = function(){
		skipDomain = true;
		graphAll();
		// domain stuff is an the beginning, and synchronous, so we don't have to wait for the workers
		skipDomain = false;
		document.getElementById('replot-at-zoom-popup').classList.add('graphing-progress-hidden');
	}
}

function linePolyIntersection(poly, lp1, lp2){
	// find intersection with plane, then determine if that is inside poly
	// line-plane intersection:
	// L(t) = lp1 + t (lp2 - lp1)
	// plane in xyz form:
	//   normal: (poly[1] - poly[0]) cross (poly[2] - poly[0])
	//   pt: poly[0]
	// ((x,y,z)-pt).normal == 0
	// ... some mathematica magic later ...
	// t = (lp1 . normal - pt . normal) / (normal . (lp1 - lp2))
	let pt = poly[0],
		normal = cross(sub(poly[1],poly[0]), sub(poly[2],poly[0]));
	let t = (dot(lp1, normal) - dot(pt, normal)) / dot(normal, sub(lp1, lp2));
	let intersection = add(lp1, scalar(t, sub(lp2, lp1)));

	if(isNaN(intersection.x) || intersection === null || intersection === undefined){
		return null;
	}

	// now determine if this intersection lies in poly
	// project the whole thing onto the xy plane (this function is used where lp1 and lp2 are never parallel to this plane)
	// and do a scanline algorithm
	let crosses = 0;
	for(let i = 0; i < poly.length; i++){
		let p1 = poly[i],
			p2 = poly[i === poly.length - 1 ? 0 : i + 1];
		// y = intersection.y
		// L(t) = p1 + t (p2 - p1), (x, y) = (p1.x + t (p2.x-p1.x), p1.y+t(p2.y-p1.y))
		// intersection.y = p1.y+t(p2.y-p1.y)
		let t = (intersection.y-p1.y)/(p2.y-p1.y);
		if(t >= 0 && t <= 1 && p1.x+t*(p2.x-p1.x) > intersection.x){
			crosses++;
		}
	}

	if(crosses % 2 === 1){
		return intersection;
	}
	return null;
}

function readURLParameters(){
	// URL encoding reference:
	// f{n}n - nth function, what goes in the main box
	// n{n} - normal multiplier, 0 if -1 else not present
	// r - a 24 digit string, representing 3 components of the
	//  x vector and 3 of the y
	// op - a string representing the selected options
	//    m - don't shade mesh
	//    d - don't use directional lighting
	//    p - don't use perspective
	//    r - render mesh when shading
	//    n - ignore normal when shading
	//    a - don't show axes
	//    l - don't show axes labels
	//    s - miniDomain for embedding
	// q{n} - mesh quality
	// t{n} - transparency
	// s{n} - shininess
	// c{n} - color

	// if the url has a 'function' parameter, autofill the box
	let urlUtils = new URLSearchParams(window.location.search.substring(1));

	for(let funcNum = 0; urlUtils.has('f'+funcNum); funcNum++){
		// create a new domain
		if(funcNum > 0){
			document.getElementById('add-tab-button').onclick();
		}
		let newDomain = domains[domains.length - 1];

		let funcValue = urlUtils.get('f'+funcNum);
		// write function value to function input
		// the input was compressed in a very home-spun way. Don't look at me like that, it works!

		funcValue = funcValue.replace(/~l/g, '\\left');
		funcValue = funcValue.replace(/~r/g, '\\right');
		funcValue = funcValue.replace(/~\./g, ' ');
		funcValue = funcValue.replace(/~_/g, '{');
		funcValue = funcValue.replace(/~!/g, '}');
		funcValue = funcValue.replace(/~\*/g,',');
		funcValue = funcValue.replace(/~'/g, '\\');

		console.log('writing url value', funcValue);
		newDomain.expressionLatex = funcValue;

		// read domain values, if any
		for(let key of [['da','cart'],['db','cyl'],['dc','sphere'],['dd','par']]){

			let [urlKey, elementIDPart] = key;
			if(urlUtils.has(urlKey+''+funcNum)){
				let val = urlUtils.get(urlKey+''+funcNum);
				// more fun compression! Brought to you by Alan himself!

				val = val.replace(/~l/g, '\\left');
				val = val.replace(/~r/g, '\\right');
				val = val.replace(/~in/g, ' \\in');
				val = val.replace(/~\./g, ',');
				val = val.replace(/~'/g, ' ');

				let fullElName = elementIDPart === 'cart' ? 'cartesian' :
								elementIDPart === 'cyl' ? 'cylindrical' :
								elementIDPart === 'sphere' ? 'spherical':
								'parametric';
				newDomain[fullElName+'DomainLatex'] = val;
			}
		}

		// get any options
		// normal multiplier
		if(urlUtils.has('n'+funcNum)){
			newDomain.normalMultiplier = -1;
		}

		// menu options
		if(urlUtils.has('op'+funcNum)){
			let val = urlUtils.get('op'+funcNum);
			if(val.indexOf('d') !== -1){
				newDomain.directionalLighting = false;
				document.getElementById('directional-lighting-checkbox').checked = false;
			}
			if(val.indexOf('p') !== -1){
				newDomain.perspective = false;
				document.getElementById('perspective-checkbox').checked = false;
			}
			if(val.indexOf('r') !== -1){
				newDomain.showMeshWhileColoring = true;
			}
			if(val.indexOf('n') !== -1){
				newDomain.ignoreNormal = true;
			}
			if(val.indexOf('a') !== -1){
				newDomain.showAxes = false;
				document.getElementById('axes-checkbox').checked = false;
			}
			if(val.indexOf('l') !== -1){
				newDomain.showAxesLabels = false;
				document.getElementById('show-axes-labels-checkbox').checked = false;
			}
			if(val.indexOf('s') !== -1){
				domain.miniDisplay = true;
				// hide work bar
				document.getElementById('work-bar-wrapper').style.display = 'none';
				// make big Koval's 3D Grapher text smaller
				document.getElementById('title').style.fontSize = '15px';
				// remove fullscreen link (it doesn't work in iframes)
				document.getElementById('full-screen-button').style.display = 'none';
				// make reset button link visible
				document.getElementById('reset-button').style.display = 'block';
				document.getElementById('reset-button').onclick = function(){
					readURLParameters();
				}
				document.getElementById('invert-normals-embed-button').style.display = 'block';
				document.getElementById('invert-normals-embed-button').onclick = function(){
					$('#invert-normal-icon').click();
				}
			}
		}

		// mesh quality
		if(urlUtils.has('q'+funcNum)){
			let val = urlUtils.get('q'+funcNum);
			newDomain.density = parseFloat(val);
		}

		if(urlUtils.has('t'+funcNum)){
			let val = urlUtils.get('t'+funcNum);
			newDomain.transparency = parseFloat(val);
		}

		if(urlUtils.has('s'+funcNum)){
			let val = urlUtils.get('s'+funcNum);
			newDomain.shininess = parseFloat(val);
		}

		if(urlUtils.has('c'+funcNum)){
			let colorVal = urlUtils.get('c'+funcNum);
			let c1 = colorVal.substr(0, 3),
				c2 = colorVal.substr(3, 3),
				c3 = colorVal.substr(6, 3);
			newDomain.colorString = 'rgb('+[c1,c2,c3].map(x=>parseInt(x)).join(', ')+')';
			newDomain.color = rgbToHsl(...[c1,c2,c3].map(x=>parseInt(x)))[0];
		}

		domain = newDomain;
		updateGUIOnDomainSwitch();
	}

	// rotation
	// while it is technically possible to get away with only 5 components (x and y
	// are perpendicular), you run into issues when x.y ~= 0 and |y| ~= 0
	if(urlUtils.has('r')){
		let val = urlUtils.get('r');
		let xString = val.substr(0, 12);
		let yString = val.substr(12, 12);
		let xData = [xString.substr(0,4), xString.substr(4,4), xString.substr(8,4)].map(x => parseInt(x)/(x.substr(0,1)==='-' ? 100 : 1000));
		let yData = [yString.substr(0,4), yString.substr(4,4), yString.substr(8,4)].map(x => parseInt(x)/(x.substr(0,1)==='-' ? 100 : 1000));
		let xVec = {x: xData[0], y: xData[1], z: xData[2]};
		// for rounding errors
		xVec = scalar(1/magnitude(xVec), xVec);

		// yVec needs to be perpendicular to xVec, hence yVec . xVec == 0
		let yVec = {x: yData[0], y:yData[1], z:yData[2]};

		yVec = scalar(1/magnitude(yVec), yVec);

		let zVec = cross(xVec, yVec); // obviously
		axes = [xVec, yVec, zVec];

		domain = domains[0];
		updateGUIOnDomainSwitch();
	}

  // finally, graph the function
  graphAll();
}

function getLinkUrl(){
	// create url (see readURLParameters for reference)
	let url = '?'

	let funcNum = 0;
	for(let d of domains){
		domain = d;
		updateGUIOnDomainSwitch();

		url += (funcNum > 0 ? '&' : '') +'f'+funcNum+'=';
		let func = MQ(document.getElementById('equation-input')).latex();
		// we'll replace these later
		func = func.replace(/\\left/g, '~l');
		func = func.replace(/\\right/g, '~r');
		func = func.replace(/ /g, '~.');
		func = func.replace(/\\/g,'~\'');
		func = func.replace(/{/g, '~_');
		func = func.replace(/}/g, '~!');
		func = func.replace(/\,/g,'~*');
		url += encodeURIComponent(func);

		let domainLayers = [];
		// get the visible domain items
		for(let k of [['da','cart'],['db','cyl'],['dc','sphere'],['dd','par']]){
			let [code, id] = k;
			let el = document.getElementById(id+'-domain-bar');
			let style = window.getComputedStyle(el);
			if(style.display !== 'none'){
				domainLayers.push({
					code:code,
					val:MQ(el).latex()
				});
			}
		}

		for(let domainItem of domainLayers){
			let val = domainItem.val;
			val = val.replace(/\\left/g, '~l');
			val = val.replace(/\\right/g, '~r');
			val = val.replace(/\\ /g, '');
			val = val.replace(/\\in/g,'~in');
			val = val.replace(/\,/g, '~.');
			val = val.replace(/ /g, '~\'');
			url += '&'+domainItem.code+''+funcNum+'='+encodeURIComponent(val);
		}

		if(domain.normalMultiplier !== 1){
			url += '&n'+funcNum+'='+encodeURIComponent('0');
		}

		// options
		//    d - don't use directional lighting
		//    p - don't use perspective
		//    r - render mesh when shading
		//    n - ignore normals
		//    a - don't show axes
		//    l - don't show axes labels
		//    s - miniDisplay (for embedding)
		let optionsString = ''
		if(!domain.directionalLighting){
			optionsString += 'd';
		}
		if(!domain.perspective){
			optionsString += 'p';
		}
		if(domain.showMeshWhileColoring){
			optionsString += 'r';
		}
		if(!domain.showAxes){
			optionsString += 'a';
		}
		if(!domain.showAxesLabels){
			optionsString += 'l';
		}
		if(domain.ignoreNormal){
			optionsString += 'n';
		}
		if(domain.miniDisplay){
			optionsString += 's';
		}

		if(optionsString !== ''){
			url += '&op'+funcNum+'='+encodeURIComponent(optionsString);
		}

		url += '&q'+funcNum+'='+encodeURIComponent(domain.density+'');
		url += '&t'+funcNum+'='+encodeURIComponent(domain.transparency+'');
		url += '&s'+funcNum+'='+encodeURIComponent(domain.shininess+'');

		let colorEncoded = domain.colorString.replace(/ /g, '');
		let colors = colorEncoded.replace(/rgb\(/g, '').replace(/\)/g,'').split(',');
		for(let j = 0; j < colors.length; j++){
			while((colors[j]+'').length < 3){
				colors[j] = '0'+colors[j];
			}
		}

		url += '&c'+funcNum+'='+encodeURIComponent(colors.join(''));

		funcNum++;
	}

	// rotation
	let get4Digits = x => {
		let num = (x+'').replace(/\./g, '');
		while(num.length < 4){
			num += '0';
		}
		return num.substr(0,4);
	}
	let rotVal = get4Digits(axes[0].x) + get4Digits(axes[0].y) + get4Digits(axes[0].z) +
		get4Digits(axes[1].x) + get4Digits(axes[1].y) + get4Digits(axes[1].z);
	url += '&r='+encodeURIComponent(rotVal);
	return url;
}

$(window).resize(function(){
    var width = $('#content-graph').width();
    var height = $('#content-graph').height();
    if(!domain.fullscreen){
        $("#canvas").prop('width',width)
        $('#canvas').prop('height',height)
		$("#text-canvas").prop('width',width);
        $('#text-canvas').prop('height',height);
    }else{
        $("#canvas").prop('width',$(window).width())
        $('#canvas').prop('height',$(window).height())
		$("#text-canvas").prop('width',$(window).width());
        $('#text-canvas').prop('height',$(window).height());
    }
    plotPointsWebGL();
});

$('#axes-checkbox').change(function(){
	for(let d of domains){
		d.showAxes = $('#axes-checkbox').prop('checked');
	}
    plotPointsWebGL();
});

$('#color-checkbox').change(function(){
    domain.coloring = $('#color-checkbox').prop('checked');
    plotPointsWebGL();
});

$('#show-mesh-while-coloring-checkbox').change(function(){
    domain.showMeshWhileColoring = $('#show-mesh-while-coloring-checkbox').prop('checked');
    plotPointsWebGL();
});

$('#ignore-normal-checkbox').change(function(){
	domain.ignoreNormal = $('#ignore-normal-checkbox').prop('checked');

	if(domain.ignoreNormal){
		document.getElementById('invert-normal-button').style.opacity=.2;
	}else{
		document.getElementById('invert-normal-button').style.opacity=1;
	}

	plotPointsWebGL();
});

$('#mesh-quality-input').change(function(){
	domain.density = parseFloat($('#mesh-quality-input').val());
});

$('#directional-lighting-checkbox').change(function(){
	for(let d of domains){
		d.directionalLighting = $('#directional-lighting-checkbox').prop('checked');
	}
    plotPointsWebGL();
})

$('#show-axes-labels-checkbox').change(function(){
	for(let d of domains){
		d.showAxesLabels = $('#show-axes-labels-checkbox').prop('checked');
	}
    plotPointsWebGL();
})

$('#perspective-checkbox').change(function(){
	for(let d of domains){
		d.perspective = $('#perspective-checkbox').prop('checked');
	}
    plotPointsWebGL();
});

$('#transparency-input').change(function(){
	domain.transparency = parseFloat(document.getElementById('transparency-input').value);
	if(domain.transparency < 0){
		domain.transparency = 0;
	}
	if(domain.transparency > 1){
		domain.transparency = 1;
	}

	// since transparency is an attribute to webgl, we ned to refresh the buffer
	updateBuffer(domain.polyData, domain.polySkipData, domain.lineData, domain);

	plotPointsWebGL();
});
$('#shininess-input').change(function(){
	domain.shininess = parseFloat(document.getElementById('shininess-input').value);
	if(domain.shininess < 1){
		domain.shininess = 1;
	}

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
    var elem = document.getElementById('canvas-wrapper');
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

$('#more-options').click(function(){
	let menu = document.getElementById('extra-options-menu');
	menu.classList.toggle('extra-options-shone');
	menu.classList.toggle('extra-options-hidden');
	document.getElementById('get-link-button').onclick = onGetLinkClicked;
	document.getElementById('embed-button').onclick = onEmbedClicked;
	document.getElementById('embed-mathematica-button').onclick = onMathematicaEmbedClicked;
	document.getElementById('get-link-text').textContent = 'get link';
	document.getElementById('embed-button-text').textContent = 'embed in html';
	document.getElementById('embed-mathematica-text').textContent = 'embed in mathematica workbook';
	document.getElementById('export-button').onclick = function(){
		document.getElementById('save-href').click();
	}

	if(menu.classList.contains('extra-options-shone')){
		document.body.addEventListener('click', menuOpenBodyClick);
		domain.setUpDownload = true;
		plotPointsWebGL();
		domain.setUpDownload = false;
	}else{
		document.body.removeEventListener('click', menuOpenBodyClick);
		document.getElementById('embed-button').onclick = function(){}
		document.getElementById('get-link-text').onclick = function(){}
		document.getElementById('embed-mathematica-button').onclick = function(){}
	}
	return false;
});

$('#extra-options-menu').click(function(){
	return false;
});

function menuOpenBodyClick(){
	$('#more-options').click();
	return true;
}

function onGetLinkClicked(){
	let url = getLinkUrl();
	document.getElementById('get-link-text').textContent = 'https://alankoval.com/3dgrapher/src/index.html'+url;

	selectText('get-link-text');
	document.getElementById('get-link-button').onclick = function(){
		return false;
	};
};

function onEmbedClicked(){
	domain.miniDisplay = true;
	let url = getLinkUrl();
	document.getElementById('embed-button-text').textContent = '<iframe src="https://alankoval.com/3dgrapher/src/index.html'+url+'" width=\'800\' height=\'800\'><p>Your browser does not support iframe</p></iframe>';
	selectText('embed-button-text');
	document.getElementById('embed-button').onclick = function(){
		return false;
	}
}

function onMathematicaEmbedClicked(){
	domain.miniDisplay = true;
	let htmlText = '<iframe src=\\"https://alankoval.com/3dgrapher/src/index.html'+getLinkUrl()+'\\" width=\'800\' height=\'800\'><p>Your browser does not support iframe</p></iframe>';
	let finalText = 'EmbeddedHTML["'+htmlText+'"]';
	document.getElementById('embed-mathematica-text').textContent = finalText;
	selectText('embed-mathematica-text');
	document.getElementById('embed-mathematica-button').onclick = function(){
		return false;
	}
}

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

    graphAll(function(){
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
                graphAll(arguments.callee);
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

function getRealDomainCenter(){
     return {
		x:(domain.x.max + domain.x.min)/2,
		y:(domain.y.max + domain.y.min)/2,
		z:(domain.z.max + domain.z.min)/2
	}
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
    var canvas = document.getElementById('canvas');
	let textCanvas = document.getElementById('text-canvas');

	// draw the first canvas, then the text canvas onto the final one
	let finalCanvas = document.createElement('canvas');
	finalCanvas.width = canvas.width;
	finalCanvas.height = canvas.height;

	let ctx = finalCanvas.getContext('2d');
	ctx.drawImage(canvas, 0, 0);
	ctx.drawImage(textCanvas, 0, 0);

    var data = finalCanvas.toDataURL('image/png');
    data = data.replace(/^data:image\/[^;]*/, 'data:application/octet-stream');
    data = data.replace(/^data:application\/octet-stream/, 'data:application/octet-stream;headers=Content-Disposition%3A%20attachment%3B%20filename=Graph.png');
    document.getElementById('save-href').href = data;
    document.getElementById('save-href').download = 'Graph.png';
}

function evalDomain(string){
    var input = string;
    var scope = {};
    for(var j = 0; j < animationVars.length; j++){
        scope[animationVars[j].name] = animationVars[j].value;
    }
    return math.eval(input, scope);

}

function graphAll(onFinish){

  // if the input box is empty, don't graph
  if(MQ($('#equation-input')[0]).latex().length === 0){
    if(onFinish){
      onFinish();
    }
    return;
  }

	// make the little box that says "Plotting..." out
	document.getElementById('graphing-progress-popup').classList.remove('graphing-progress-hidden');

	let originalDomain = domain;

	if(skipDomain){
		// clip the domains to globalViewPoint, if applicable
		for(let d of domains){
			for(let i of ['x','y','z']){
				let spreadMin = antiSpread(d[i].original.min, d.spreadCenter[i], d[i].spread),
					spreadMax = antiSpread(d[i].original.max, d.spreadCenter[i], d[i].spread);
				// all domain spreads are the same
				let gSpreadMin = antiSpread(globalViewPoint[i].min, d.spreadCenter[i], d[i].spread),
					gSpreadMax = antiSpread(globalViewPoint[i].max, d.spreadCenter[i], d[i].spread);

				// obviously, the domain should shrink to fit inside globalViewPoint
				if(spreadMin < gSpreadMin){
					spreadMin = gSpreadMin;
				}
				if(spreadMax > gSpreadMax){
					spreadMax = gSpreadMax;
				}

				// however, it's slightly less obvious as to what should happen if globalViewPoint expands
				// I've decided to expand any domain that touches the edge, otherwise expand to original size
				if(d[i].original.maxOnViewBorder){
					spreadMax = gSpreadMax;
				}
				if(d[i].original.minOnViewBorder){
					spreadMin = gSpreadMin;
				}

				d[i].min = spreadMin;
				d[i].max = spreadMax;
			}
		}
	}

	// read all the domains' inputs, deal with global spreads and such
	let max = {x:null,y:null,z:null},
		min = {x:null,y:null,z:null};
	for(let d of domains){
		domain = d;
		updateGUIOnDomainSwitch();
		if(!skipDomain){
			readDomainInputs();
		}

		for(let i of ['x','y','z']){
			max[i] = max[i] === null || domain[i].max > max[i] ? domain[i].max : max[i];
			min[i] = min[i] === null || domain[i].min < min[i] ? domain[i].min : min[i];
		}
	}

	// all functions should match spread and spread center
	let spreadCenter = scalar(.5, add(min, max));

	globalViewPoint = {
		x:{min: min.x, max: max.x},
		y:{min: min.y, max: max.y},
		z:{min: min.z, max: max.z}
	};
	globalViewPoint.center = {
		x: spreadCenter.x,
		y: spreadCenter.y,
		z: spreadCenter.z
	}

	let maxGap = Math.max(max.x - min.x, max.y - min.y, max.z - min.z);
	for(let d of domains){
		d.spreadCenter = spreadCenter;
		d.globalViewPoint = globalViewPoint;
		d.center = {};

		for(let i of ['x','y','z']){
			d[i].spread = maxGap / (max[i] - min[i]);
			d[i].min = spreadCoord(d[i].min, d.spreadCenter[i], d[i].spread);
			d[i].max = spreadCoord(d[i].max, d.spreadCenter[i], d[i].spread);
			d.center[i] = (d[i].min + d[i].max)/2;

			// for replot-on-zoom button
			if(!skipDomain){
				d[i].original = {
					min: d[i].min,
					max: d[i].max
				};
				// close enough to edge
				if(Math.abs(d[i].min - min[i]) < (max[i]-min[i])/1000000){
					d[i].original.minOnViewBorder = true;
				}
				if(Math.abs(d[i].max - max[i]) < (max[i]-min[i])/1000000){
					d[i].original.maxOnViewBorder = true;
				}
			}
		}
	}

	let graphsFinished = 0;
	for(let d of domains){
		domain = d;
		updateGUIOnDomainSwitch();
		graph(() => {
			graphsFinished++;
			// all the plots are finished
			if(graphsFinished === domains.length){
				// make the plotting popup disappear
				document.getElementById('graphing-progress-popup').classList.add('graphing-progress-hidden');
				setGlobalExtrema();
				updateAxisBuffer();

				plotPointsWebGL();
			}
		});
	}
	domain = originalDomain;
	updateGUIOnDomainSwitch();

	plotPointsWebGL();
}

function readDomainInputs(){
	['cart','cyl','sphere','par'].forEach(val => {
		var field = MQ($('#'+val+'-domain-bar')[0]);
		var latex = parseLatex(field.latex(), animationVars);
		var result = parseDomain(latex);

		// change z to height, phi to sphi in corresponding coordinate systems
		if(val === 'cyl'){
			let zVal = result.filter(x => x.varName === 'z')[0];
			if(zVal){
				zVal.varName='height';
			}
		}
		if(val === 'sphere'){
			let phiVal = result.filter(x => x.varName === 'phi')[0];
			if(phiVal){
				phiVal.varName='sphi';
			}
		}

		result.forEach(val => {
			domain[val.varName].min = math.eval(val.range.min);
			domain[val.varName].max = math.eval(val.range.max);
		});
	});
}

function graph(onFinish){
    domain.stopAnimating = true;
    MQ = MathQuill.getInterface(2);
    if(!onFinish){
        onFinish = function(){};
    }

    spread = {x:domain.x.spread, y:domain.y.spread, z:domain.z.spread}

    var density = parseInt($('#mesh-quality-input').val(),10);
    domain.density = density;

    //reset domain
    if(domain.pointsOnly === true){
        domain.coloring = true;
        plotPointsWebGL();

    }else{
        var inputs = {
            x: '',
            y: '',
            z:''
        }
        var exp = domain.expressionInfo.expression;

		// change z to height in cylindrical system
		for(let i = 0; i  < exp.vars.length; i++){
			if(exp.vars[i] === 'z' && domain.currentSystem.indexOf('cylindrical') !== -1){
				exp.vars[i] = 'height';
			}
			if(exp.vars[i] === 'phi' && domain.currentSystem.indexOf('spherical') !== -1){
				exp.vars[i] = 'sphi';
			}
		}

		// change exp.body too
		if(domain.currentSystem.indexOf('cylindrical') !== -1){
			exp.body = exp.body.replace(/\(z\)/g, '(height)');
		}else if(domain.currentSystem.indexOf('spherical') !== -1){
			exp.body = exp.body.replace(/\(phi\)/g, '(sphi)');
		}

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
            inputs[exp.vars[0]] = exp.body;

            var otherVars = ['x','y','z'].filter(x => x !== exp.vars[0]);

            inputs[otherVars[0]] = 'u';
            inputs[otherVars[1]] = 'v';

            domain.u.max = antiSpread(domain[otherVars[0]].max, domain.spreadCenter[otherVars[0]], domain[otherVars[0]].spread);
            domain.u.min = antiSpread(domain[otherVars[0]].min, domain.spreadCenter[otherVars[0]], domain[otherVars[0]].spread);

            domain.v.max = antiSpread(domain[otherVars[1]].max, domain.spreadCenter[otherVars[1]], domain[otherVars[1]].spread);
            domain.v.min = antiSpread(domain[otherVars[1]].min, domain.spreadCenter[otherVars[1]], domain[otherVars[1]].spread);
        }else if(domain.currentSystem.indexOf('cylindrical') !== -1 || domain.currentSystem.indexOf('spherical') !== -1){

            var cyl = domain.currentSystem.indexOf('cylindrical') !== -1;
            var cylInputs = cyl ? {rho:'', phi:'', height:''} : {r:'', theta:'', sphi:''};
            cylInputs[exp.vars[0]] = exp.body;

            var otherVars = (cyl ? ['rho','phi','height'] : ['r','theta','sphi']).filter(x => x !== exp.vars[0]);

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
                inputs.z = cylInputs.height;
            }else{
                inputs.x = '('+cylInputs.r+')*cos('+cylInputs.theta+')*cos('+cylInputs.sphi+')';
                inputs.y = '('+cylInputs.r+')*sin('+cylInputs.theta+')*cos('+cylInputs.sphi+')';
                inputs.z = '('+cylInputs.r+')*sin('+cylInputs.sphi+')';
            }
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

function refreshMathJax(){
    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
}

function graphParametricFunction(xFunc, yFunc, zFunc, spread, onFinish){
	// we had some leaking, where it was rendering slower and slower.
	// call me lazy, but hey, it works with negligable overhead
	initWebGL();

	let graphDomain = domain;

	// give our webworker(s) some work to do
	graphDomain.polyData = [];
	graphDomain.lineData = [];
	graphDomain.polyNumber = 0;
	updateBuffer([],[],[], graphDomain);
	graphDomain.extrema = null;

	let lastUpdateTime = Date.now();

	graphID = Math.floor(Math.random() * 1e16);

	let domainIndex = domains.indexOf(graphDomain);

	while(domainIndex > graphWorkersPool.length - 1){
		graphWorkersPool.push([]);
	}

	let graphWorkers = graphWorkersPool[domainIndex];

	let workerIndex = 0;
	while(graphWorkers.length < (Math.max((navigator.hardwareConcurrency - 1) / domains.length, 1) | 2)){
		console.log('creating worker ', domains.indexOf(domain), workerIndex);
		// create a worker
		graphWorkers.push({
			worker: new Worker('mesh.js'),
			idle: true,
			index: workerIndex,
			subdivisionIndex:null,
			graphID:graphID
		});
		workerIndex++;
	}

	document.getElementById('cancel-plot-button').onclick = function(e){
		console.log('terminating all workers...');
		for(let k = 0; k < graphWorkersPool.length; k++){
			for(let w of graphWorkersPool[k]){
				w.worker.terminate();
			}
			graphWorkersPool[k] = [];
			graphWorkers = graphWorkersPool[k];
		}
		document.getElementById('graphing-progress-popup').classList.add('graphing-progress-hidden');
	}

	// the domain will be divided into 16 zones, each a square
	let subdivisions = [];
	let subSideCount = 3;

	let uGap = (graphDomain.u.max - graphDomain.u.min) / subSideCount;
	let vGap = (graphDomain.v.max - graphDomain.v.min) / subSideCount;
	let subdivisionCount = 0;

	graphDomain.polySkipData = [];

	for(let x = 0; x < subSideCount; x++){
		for(let y = 0; y < subSideCount; y++){
			let newSub = {
				completed:false,
				// if a worker is currently working on it
				tagged:false,
				index:subdivisionCount,
				region:{
					u:{
						min: graphDomain.u.min + x * uGap,
						max: graphDomain.u.min + (x + 1) * uGap
					},
					v:{
						min: graphDomain.v.min + y * vGap,
						max: graphDomain.v.min + (y + 1) * vGap
					}
				}
			};

			subdivisions.push(newSub);
			subdivisionCount++;

			// create a spot for the polyData
			graphDomain.polyData.push([]);
			graphDomain.polySkipData.push([]);
			graphDomain.lineData.push([]);
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
			graphWorkersPool[domainIndex] = [];
			graphWorkers = graphWorkersPool[domainIndex];

			updateBuffer(graphDomain.polyData, graphDomain.polySkipData, graphDomain.lineData, graphDomain);
			onFinish();
		}else if(subIndex === -1){
			// nothing more for this web worker to do, terminate it
			graphWorker.worker.terminate();
			graphWorkers.splice(graphWorker.index, 1);
		}else{
			// assign the worker to the subdivision
			let workerSubdivision = subdivisions[subIndex];

			// copy domain to change it for the worker
			// we don't want to pass polyData or anything like that to the worker
			let tempAttribNames = ['polyData', 'lineData', 'polySkipData', 'polyBuffer', 'lineBuffer'];
			let tempAttribValues = tempAttribNames.map(x => graphDomain[x]);

			for(let name of tempAttribNames){
				graphDomain[name] = null;
			}

			let workerDomain = JSON.parse(JSON.stringify(graphDomain));

			for(let j = 0; j < tempAttribNames.length; j++){
				graphDomain[tempAttribNames[j]] = tempAttribValues[j];
			}

			workerDomain.u = workerSubdivision.region.u;
			workerDomain.v = workerSubdivision.region.v;
			workerDomain.global = {
				u: graphDomain.u,
				v: graphDomain.v,
				subdivisionSideCount: subSideCount
			};

			graphWorker.subdivisionIndex = workerSubdivision.index;
			workerSubdivision.tagged = true;

			//console.log('worker '+graphWorker.index+' has been assigned',domains.indexOf(graphDomain));

			graphWorker.domain = graphDomain;

			// trigger the worker
			graphWorker.worker.postMessage(['GRAPH', xFunc, yFunc, zFunc, workerDomain]);

			// handle responses
			graphWorker.worker.onmessage = function(e){
				let responseType = e.data.type,
					data = e.data.data;
				let d = graphWorker.domain;
				if(responseType === 'POLYGON_UPDATE'){
					// draw the updates
					// expected args: [polydata, polygons.length]
					for(let el of (new Float32Array(data))){
						d.polyData[graphWorker.subdivisionIndex].push(el);
					}

				}else if(responseType === 'LINE_UPDATE'){

					for(let el of (new Float32Array(data))){
						d.lineData[graphWorker.subdivisionIndex].push(el);
					}

				}else if(responseType === 'POLYGON_MODIFY'){
					// one can only call this function ONCE! (the polygon indices will get messed up)
					let modificationData = new Float32Array(data);

					// the modification buffer is comprised of 28 element-length blocks
					// the first float is the position in the polygon index, the next
					// 27 floats is the replacement data
					let time = Date.now();
					let baseIndex = 0;
					for(let j = 0; j < modificationData.length; j++){
						if(j % 28 === 0){
							baseIndex = Math.round(modificationData[j]) * 27;
						}else{
							d.polyData[graphWorker.subdivisionIndex][baseIndex + j % 28 - 1] = modificationData[j];
						}
					}
				}else if(responseType === 'POLYGON_REMOVE'){

					d.polySkipData[graphWorker.subdivisionIndex] = new Float32Array(data);

				}else if(responseType === 'EXTREMA'){
					// synthesize extrema result
					let workerExtrema = data;
					if(!d.extrema){
						d.extrema = workerExtrema;
					}else{
						let objs = ['x','y','z'];
						for(let i of objs){
							d.extrema[i].max = workerExtrema && d.extrema[i].max < workerExtrema[i].max ? workerExtrema[i].max : d.extrema[i].max;
							d.extrema[i].min = workerExtrema && d.extrema[i].min > workerExtrema[i].min ? workerExtrema[i].min : d.extrema[i].min;
						}
					}
				}else if(responseType === 'FINISHED'){
					//console.log('worker '+graphWorker.index+' has finished');
					updateBuffer(d.polyData, d.polySkipData, d.lineData, d);

					workerSubdivision.completed = true;
					// reassign this worker
					onIdleWorker(graphWorker);
					plotPointsWebGL();
				}

				// since there are many webworkers about, there will be at least one update every 500ms,
				// (or however long it is), but probably many more. Thus we'll time actual redraws ourselves
				if(Date.now() - lastUpdateTime > 500){
					updateBuffer(d.polyData, d.polySkipData, d.lineData, d);
					plotPointsWebGL();
					lastUpdateTime = Date.now();
					plotPointsWebGL();
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

function spreadCoord(val, center, spread){
    var valRel = val - center;
    return valRel*spread + center;
}

// inverse of spreadCoord
function antiSpread(val, center, spread){
	let valRel = val - center;
	return valRel/spread + center;
}

function pointToQuat(p){
    return {w:0,x:p.x,y:p.y,z:p.z};
}

// assumes that all points and polygons have been created
function initWebGL(){
	let gl = document.getElementById('canvas').getContext('webgl', {alpha: false} );

	if(!gl){
		alert('Your browser does not support webgl. I\'m really not sure what browser you could possibly be using, but I suggest you update, or better yet, download Chrome.');
		return;
	}

	// create vertex shader
	let vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, document.getElementById('vertex-shader').text);
	gl.compileShader(vertexShader);

	//console.log(gl.getShaderInfoLog(vertexShader));

	// create fragment shader
	let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, document.getElementById('fragment-shader').text);
	gl.compileShader(fragmentShader);

	//console.log(gl.getShaderInfoLog(fragmentShader));

	// create our program
	let program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	//console.log(gl.getProgramInfoLog(program));

	// get attribute/uniform locations
	webGLInfo.positionLocation = gl.getAttribLocation(program, 'a_position');
	webGLInfo.normalLocation = gl.getAttribLocation(program, 'a_normal');
	webGLInfo.bariLocation = gl.getAttribLocation(program, 'a_bari_coord');
	webGLInfo.transparencyLocation = gl.getAttribLocation(program, 'a_transparency');
	webGLInfo.colorHueLocation = gl.getAttribLocation(program, 'a_hue');

	webGLInfo.orientationXLocation = gl.getUniformLocation(program, 'u_orientation_x');
	webGLInfo.orientationYLocation = gl.getUniformLocation(program, 'u_orientation_y');
	webGLInfo.orientationZLocation = gl.getUniformLocation(program, 'u_orientation_z');
	webGLInfo.domainCenterLocation = gl.getUniformLocation(program, 'u_domain_center');
	webGLInfo.aspectRatioLocation = gl.getUniformLocation(program, 'u_aspect_ratio');
	webGLInfo.domainHalfWidthLocation = gl.getUniformLocation(program, 'u_domain_halfwidth');
	webGLInfo.borderLocation = gl.getUniformLocation(program, 'u_draw_borders');
	webGLInfo.perspectiveLocation = gl.getUniformLocation(program, 'u_perspective');
	webGLInfo.directionalLightingLocation = gl.getUniformLocation(program, 'u_directional_lighting');
	webGLInfo.normalMultiplierLocation = gl.getUniformLocation(program, 'u_normal_multiplier');
	webGLInfo.ignoreNormalLocation = gl.getUniformLocation(program, 'u_ignore_normal');
	webGLInfo.shininessLocation = gl.getUniformLocation(program, 'u_shininess');

	// make our buffer
	let buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

	// put the data in polygons into an array
	let polyData = [];

	webGLInfo.polyBuffer = new Float32Array(polyData);

	webGLInfo.gl = gl;
	webGLInfo.program = program;
	webGLInfo.initialized = true;

	// create our axis box data / program
	let axisVertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(axisVertexShader, document.getElementById('axis-vertex-shader').text);
	gl.compileShader(axisVertexShader);

	//console.log(gl.getShaderInfoLog(axisVertexShader));

	let axisFragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(axisFragmentShader, document.getElementById('axis-fragment-shader').text);
	gl.compileShader(axisFragmentShader);

	//console.log(gl.getShaderInfoLog(axisFragmentShader));

	let axisProgram = gl.createProgram();
	gl.attachShader(axisProgram, axisVertexShader);
	gl.attachShader(axisProgram, axisFragmentShader);
	gl.linkProgram(axisProgram);

	//console.log(gl.getProgramInfoLog(axisProgram));

	webGLInfo.axisProgram = axisProgram;

	// attributes / uniforms
	webGLInfo.axisPositionLocation = gl.getAttribLocation(axisProgram, 'a_position');

	webGLInfo.axisOrientationXLocation = gl.getUniformLocation(axisProgram, 'u_orientation_x');
	webGLInfo.axisOrientationYLocation = gl.getUniformLocation(axisProgram, 'u_orientation_y');
	webGLInfo.axisOrientationZLocation = gl.getUniformLocation(axisProgram, 'u_orientation_z');
	webGLInfo.axisAspectRatioLocation = gl.getUniformLocation(axisProgram, 'u_aspect_ratio');
	webGLInfo.axisDomainCenterLocation = gl.getUniformLocation(axisProgram, 'u_domain_center');
	webGLInfo.axisDomainHalfWidthLocation = gl.getUniformLocation(axisProgram, 'u_domain_halfwidth');
	webGLInfo.axisPerspectiveLocation = gl.getUniformLocation(axisProgram, 'u_perspective');
	webGLInfo.axisColorLocation = gl.getUniformLocation(axisProgram, 'u_color');

	// set our axis buffer
	updateAxisBuffer();

}

function updateBuffer(polyDatas, skipDatas, lineDatas, d){
	let j = 0;
	let totalLength = 0;
	for(let polyD of polyDatas){
		totalLength += (polyD.length - skipDatas[j].length*27) + 2*(polyD.length - skipDatas[j].length*27)/9;
		j++;
	}

	let bufferData = new Float32Array(totalLength);
	let i = 0;
	j = 0;
	for(let polyD of polyDatas){
		let c = 0;
		let skipArray = skipDatas[j];
		let skipArrayIndex = 0;
		for(let k = 0; k < polyD.length; k++){
			if(skipArrayIndex < skipArray.length && k === skipArray[skipArrayIndex] * 27){
				k += 26;
				skipArrayIndex++;
				continue;
			}
			let item = polyD[k];
			bufferData[i] = item;
			i++;
			c++;
			// insert after every data point
			if(c === 9){
				bufferData[i] = d.transparency;
				i++;
				bufferData[i] = d.color;
				i++;
				c = 0;
			}
		}
		j++;
	}

	totalLength = 0;
	if(lineDatas){
		for(let lineD of lineDatas){
			totalLength += lineD.length;
		}

		let lineBufferData = new Float32Array(totalLength);
		i = 0;
		for(let lineD of lineDatas){
			for(let item of lineD){
				lineBufferData[i] = item;
				i++;
			}
		}

		// 3 for position times 2 points per line
		d.lineNumber = lineBufferData.length / 6;

		d.lineBuffer = lineBufferData;
	}

	// 3 for position, 3 for normal, 3 for barimetric data, 1 for transparency, 1 for hue per each point (of which
	// there are 3 per triangle)
	d.polyNumber = bufferData.length / 33;

	d.polyBuffer = bufferData;

}

function setGlobalExtrema(){
	for(let i of ['x','y','z']){
		globalExtrema[i].min = (domain[i].min+domain[i].max)/2;
		globalExtrema[i].max = (domain[i].min+domain[i].max)/2;
	}
	for(let d of domains){
		if(!d.extrema){
			continue;
		}
		for(let i of ['x','y','z']){
			if(d.extrema[i].min < globalExtrema[i].min){
				globalExtrema[i].min = d.extrema[i].min;
			}
			if(d.extrema[i].max > globalExtrema[i].max){
				globalExtrema[i].max = d.extrema[i].max;
			}
		}
	}
}

function updateAxisBuffer(){
	// our axis is made of line segments. The only attributes that we will need are 3 floats for position, or 12 bytes

	// convenience array
	let ptArray = [
		domain.x.min,
		domain.x.max,
		domain.y.min,
		domain.y.max,
		domain.z.min,
		domain.z.max
	];

	if(globalExtrema.x){
		ptArray = [
			globalExtrema.x.min,
			globalExtrema.x.max,
			globalExtrema.y.min,
			globalExtrema.y.max,
			globalExtrema.z.min,
			globalExtrema.z.max
		];
	}

	const lines = [];
	const textAxes = [];

	// each line segment is the result of holding two of the variables constant
	// secondaryMax / tertiaryMax are booleans determining which direction the ticks marks go
	function axisSegment(c1, c2, varyIndex, secondaryMax, tertiaryMax){

		// this is going to be confusing since stretched domains
		// have the "real" coordinates "stretched" coordinates
		//   "stretched" - a coordinate that **plots** where the "real" coordinate would
		//      show up on the screen
		//   "real" - the mathematical definition of the point

		const varyCoord = ['x','y','z'][varyIndex];
		let varyMin = domain[varyCoord].min,
			varyMax = domain[varyCoord].max;

		// use extrema if possible
		if(globalExtrema){
			varyMin = globalExtrema[varyCoord].min;
			varyMax = globalExtrema[varyCoord].max;
		}

		const maxGap = (varyMax - varyMin) / domain[varyCoord].spread;
		const maxStep = 10**Math.floor(Math.log10(maxGap));
		const minStep = maxStep * 10 ** (- domain.axisPrecision);

		// draw the backbone first
		lines.push([c1, c2]);

		// which variable which defines the drawing plane
		const secondaryIndex = [0,1,2].filter(x => x !== varyIndex)[0];
		const tertiaryIndex = [0,1,2].filter(x => x !== varyIndex)[1];

		// a plotted characteristic, so streched
		const maxLineLength = secondaryIndex === 0 ? (ptArray[1] - ptArray[0]) / 20 :
			secondaryIndex === 1 ? (ptArray[3] - ptArray[2]) / 20 :
			secondaryIndex === 2 ? (ptArray[5] - ptArray[4]) / 20 : 0;

		// a real characteristic
		const c1Val = antiSpread(c1[varyIndex], domain.spreadCenter[varyCoord], domain[varyCoord].spread),
			c2Val = antiSpread(c2[varyIndex], domain.spreadCenter[varyCoord], domain[varyCoord].spread);

		const minVal = (Math.floor(c1Val / minStep) + 1) * minStep,
			steps = Math.floor((c2Val - c1Val) / minStep) - 1;

		//console.log(minStep, maxLineLength, minVal, steps);
		let textNodes = [];

		for(let i = 0; i < steps; i++){
			const varyVal = minVal + i * minStep;

			let decScore = 0;
			let normalized = 0;
			// special case for the very special number zero
			if(varyVal !== 0){
				// determine the length of the line (round for floating point error)
				normalized = Math.round(varyVal / minStep);
				let normalized2 = normalized * 2;
				while(normalized % 10 === 0){
					normalized /= 10;
					decScore++;
				}

				// if double the value is a bigger decScore, increase decScore by 1/2
				let fiveScore = 0;
				while(normalized2 % 10 === 0){
					normalized2 /= 10;
					fiveScore++;
				}

				if(fiveScore > decScore){
					decScore += .5;
				}
			}else{
				decScore = domain.axisPrecision;
			}

			const normalizedDecScore = decScore / domain.axisPrecision;
			// and finally draw the line
			let base = [...c1];
			// re-spread the coordinate to stretched form
			base[varyIndex] = spreadCoord(varyVal, domain.spreadCenter[varyCoord], domain[varyCoord].spread);

			let end = [...base];
			end[secondaryIndex] += maxLineLength * normalizedDecScore * (secondaryMax ? -1 : 1);

			let end2 = [...base];
			end2[tertiaryIndex] += maxLineLength * normalizedDecScore * (tertiaryMax ? -1 : 1);

			// make a text node just outside the axis with the value
			let textNode = {};

			textNode.pos = [...base];
			textNode.pos[secondaryIndex] -= maxLineLength * .25 *  (secondaryMax ? -1 : 1);
			textNode.pos[tertiaryIndex] -= maxLineLength * .25 * (tertiaryMax ? -1 : 1);
			[textNode.x, textNode.y, textNode.z] = textNode.pos;

			varyValForText = (Math.abs(varyVal) > 1000 || Math.abs(varyVal) < 0.001) && varyVal !== 0 ? varyVal.toExponential(4)+'' : varyVal+'';
			// fun floating point error. How fun.
			if(varyValForText.length > 12){
				let negative = false;
				let varyValT = varyVal;
				if(varyVal < 0){
					negative = true;
					varyValT *= -1;
				}
				// round it
				varyValForText = Math.round(varyValT * 1000)+'';
				// forward pad with zeros
				while(varyValForText.length < 4){
					varyValForText = '0'+varyValForText;
				}
				// insert decimal point (three from end)
				varyValForText = varyValForText.substring(0, varyValForText.length-3)+'.'+varyValForText.substr(varyValForText.length-3, 3);
				// remove trailing zeros
				let lastChar = varyValForText.substr(varyValForText.length-1, 1);
				while(lastChar === '0'){
					varyValForText = varyValForText.substr(0, varyValForText.length - 1);
					lastChar = varyValForText.substr(varyValForText.length-1, 1);
				}
				if(lastChar === '.'){
					varyValForText = varyValForText.substr(0, varyValForText.length - 1);
				}

				if(negative){
					varyValForText = '-'+varyValForText;
				}
			}

			textNode.text = varyValForText;
			textNode.fontMultiplier = 1;

			if(decScore > 1){
				textNodes.push(textNode);
			}

			lines.push([base, end]);
			lines.push([base, end2]);
		}

		// the actual axis letter label
		let averagePt = {
			x:(c1[0]+c2[0])/2,
			y:(c1[1]+c2[1])/2,
			z:(c1[2]+c2[2])/2
		};

		let labelNode = {
			text:['x','y','z'][varyIndex],
			x: averagePt.x,
			y: averagePt.y,
			z: averagePt.z,
			fontMultiplier:1.5
		};
		labelNode[['x','y','z'][secondaryIndex]] -= maxLineLength * .75 * (secondaryMax ? -1 : 1);
		labelNode[['x','y','z'][tertiaryIndex]] -= maxLineLength * .75 * (tertiaryMax ? -1 : 1);

		textNodes.push(labelNode);


		textAxes.push({
			nodes:textNodes,
			axis:varyIndex,
			averagePt:averagePt
		});
	}

	let axisProtoDataX = [
		[[0,2,4],[1,2,4]],
		[[0,2,5],[1,2,5]],
		[[0,3,4],[1,3,4]],
		[[0,3,5],[1,3,5]]
	];
	let axisProtoDataY = [
		[[0,2,4],[0,3,4]],
		[[1,2,4],[1,3,4]],
		[[0,2,5],[0,3,5]],
		[[1,2,5],[1,3,5]]
	];
	let axisProtoDataZ = [
		[[0,2,4],[0,2,5]],
		[[0,3,4],[0,3,5]],
		[[1,2,4],[1,2,5]],
		[[1,3,4],[1,3,5]]
	];
	for(let a of axisProtoDataX){
		axisSegment(a[0].map(x=>ptArray[x]), a[1].map(x=>ptArray[x]), 0, a[0][1] === 3, a[0][2] === 5);
	}
	for(let a of axisProtoDataY){
		axisSegment(a[0].map(x=>ptArray[x]), a[1].map(x=>ptArray[x]), 1, a[0][0] === 1, a[0][2] === 5);
	}
	for(let a of axisProtoDataZ){
		axisSegment(a[0].map(x=>ptArray[x]), a[1].map(x=>ptArray[x]), 2, a[0][0] === 1, a[0][1] === 3);
	}

	globalViewPoint.textAxes = textAxes;

	const axisData = [];

	// create our buffer array
	for(let line of lines){
		let [p1,p2] = line;
		axisData.push(...p1);
		axisData.push(...p2);
	}

	webGLInfo.axisBuffer = new Float32Array(axisData);
	webGLInfo.axisLineCount = axisData.length / 6;
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

	// AXES ---------
	gl.useProgram(webGLInfo.axisProgram);

	// location, size, type, normalize, stride, offset
	gl.vertexAttribPointer(webGLInfo.axisPositionLocation, 3, gl.FLOAT, false, 12, 0);
	gl.enableVertexAttribArray(webGLInfo.axisPositionLocation);

	// set uniforms
	gl.uniform3fv(webGLInfo.axisOrientationXLocation, [axes[0].x, axes[0].y, axes[0].z]);
	gl.uniform3fv(webGLInfo.axisOrientationYLocation, [axes[1].x, axes[1].y, axes[1].z]);
	gl.uniform3fv(webGLInfo.axisOrientationZLocation, [axes[2].x, axes[2].y, axes[2].z]);

	gl.uniform3fv(webGLInfo.axisDomainCenterLocation, [globalViewPoint.center.x, globalViewPoint.center.y, globalViewPoint.center.z]);
	gl.uniform1f(webGLInfo.axisDomainHalfWidthLocation, (globalViewPoint.x.max - globalViewPoint.x.min) / 2);
	globalViewPoint.aspectRatio = canvas.width/canvas.height;
	gl.uniform1f(webGLInfo.axisAspectRatioLocation, globalViewPoint.aspectRatio);

	gl.uniform1f(webGLInfo.axisPerspectiveLocation, domain.perspective ? 1 : -1);

	gl.uniform4fv(webGLInfo.axisColorLocation, [.4,.4,.4,1]);

	if(domain.showAxes){
		gl.bufferData(gl.ARRAY_BUFFER, webGLInfo.axisBuffer, gl.STATIC_DRAW);
		gl.drawArrays(gl.LINES, 0, webGLInfo.axisLineCount * 2);
	}

	// LINES ---------
	// conveniently, we can just reuse the axis program

	gl.uniform4fv(webGLInfo.axisColorLocation, [.3,.3,.3,1]);

	for(let d of domains){
		if(d.lineBuffer && d.lineBuffer.length > 0){
			gl.bufferData(gl.ARRAY_BUFFER, d.lineBuffer, gl.STATIC_DRAW);
			gl.drawArrays(gl.LINES, 0, d.lineNumber * 2);
		}
	}


	// POlYGONS ----------
	gl.useProgram(webGLInfo.program);

	// location, size, type, normalize, stride, offset
	gl.vertexAttribPointer(webGLInfo.positionLocation, 3, gl.FLOAT, false, 44, 0);
	gl.enableVertexAttribArray(webGLInfo.positionLocation);

	gl.vertexAttribPointer(webGLInfo.normalLocation, 3, gl.FLOAT, false, 44, 12);
	gl.enableVertexAttribArray(webGLInfo.normalLocation);

	gl.vertexAttribPointer(webGLInfo.bariLocation, 3, gl.FLOAT, false, 44, 24);
	gl.enableVertexAttribArray(webGLInfo.bariLocation);

	gl.vertexAttribPointer(webGLInfo.transparencyLocation, 1, gl.FLOAT, false, 44, 36);
	gl.enableVertexAttribArray(webGLInfo.transparencyLocation);

	gl.vertexAttribPointer(webGLInfo.colorHueLocation, 1, gl.FLOAT, false, 44, 40);
	gl.enableVertexAttribArray(webGLInfo.colorHueLocation);

	// set uniforms
	gl.uniform3fv(webGLInfo.orientationXLocation, [axes[0].x, axes[0].y, axes[0].z]);
	gl.uniform3fv(webGLInfo.orientationYLocation, [axes[1].x, axes[1].y, axes[1].z]);
	gl.uniform3fv(webGLInfo.orientationZLocation, [axes[2].x, axes[2].y, axes[2].z]);

	gl.uniform3fv(webGLInfo.domainCenterLocation, [globalViewPoint.center.x, globalViewPoint.center.y, globalViewPoint.center.z]);
	gl.uniform1f(webGLInfo.domainHalfWidthLocation, (globalViewPoint.x.max - globalViewPoint.x.min) / 2);
	gl.uniform1f(webGLInfo.aspectRatioLocation, canvas.width / canvas.height);

	gl.uniform1f(webGLInfo.perspectiveLocation, domain.perspective ? 1 : -1);
	gl.uniform1f(webGLInfo.directionalLightingLocation, domain.directionalLighting ? 1 : -1);

	// for transparency to work correctly, we need to draw all the solid surfaces first,
	// then sort the remaining transparent polygons from back to front and draw them that way
	let sortedDomains = domains.concat().sort((a,b) => b.transparency - a.transparency);
	for(let d of sortedDomains){
		gl.uniform1f(webGLInfo.normalMultiplierLocation, d.normalMultiplier);
		gl.uniform1f(webGLInfo.ignoreNormalLocation, d.ignoreNormal ? 1 : -1);
		gl.uniform1f(webGLInfo.shininessLocation, d.shininess);

		let transparency = d.coloring ? d.transparency : 0;
		let showBorder = !d.coloring || d.showMeshWhileColoring;

		let transparencyBuffer = [];
		let transparentPolyLength = 0;
		if(d.coloring && transparency === 1){
			gl.depthMask(true);
			gl.disable(gl.BLEND);
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.LEQUAL);
		}else{
			gl.depthMask(false);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

			// combine all remaining buffers, sort by z
			// one chunk for each poly, 33 floats
			let remainingBuffers = domains.filter(x => x.transparency !== 1 && x.transparency !== 0);
			chunkArray = new Array(remainingBuffers.reduce((a,b) => a + b.polyBuffer.length, 0) / 33);
			let chunkCount = 0;
			for(let k = 0; k < remainingBuffers.length; k++){
				let b = remainingBuffers[k].polyBuffer;
				for(let i = 0; i < b.length; i += 33){
					// grab the buffer index and the average of the 3rd, 13th and 23rd element (z val)
					let p1Z = simulateWebGLClipspace({x:b[i],y:b[i+1],z:b[i+2]}).clipspace.z,
						p2Z = simulateWebGLClipspace({x:b[i+11],y:b[i+12],z:b[i+13]}).clipspace.z,
						p3Z = simulateWebGLClipspace({x:b[i+22],y:b[i+23],z:b[i+24]}).clipspace.z
					chunkArray[chunkCount] = [k, i, p1Z + p2Z + p3Z];
					chunkCount++;
				}
			}

			// sort polygons by z
			chunkArray.sort((a,b) => b[2] - a[2]);

			transparencyBuffer = new Float32Array(chunkArray.length * 33);
			let count = 0;
			// rebuild transparencyBuffer
			for(let el of chunkArray){
				const remBuffIndex = el[0]
				for(let i = el[1]; i < el[1] + 33; i++){
					transparencyBuffer[count] = remainingBuffers[remBuffIndex].polyBuffer[i];
					count++;
				}
			}

			transparentPolyLength = transparencyBuffer.length / 33;
		}

		gl.uniform1f(webGLInfo.borderLocation, showBorder);

		// true transparency means we have to sort the transparent polygons and render them
		// all at once. Hence, when we have transparent polygons to draw we're done.
		if(transparentPolyLength > 0){
			gl.bufferData(gl.ARRAY_BUFFER, transparencyBuffer, gl.STATIC_DRAW);
			gl.drawArrays(gl.TRIANGLES, 0, transparentPolyLength * 3);
			break;
		}
		if(d.polyNumber && d.polyNumber > 0){
			// primitive type, offset, count
			gl.bufferData(gl.ARRAY_BUFFER, d.polyBuffer, gl.STATIC_DRAW);
			gl.drawArrays(gl.TRIANGLES, 0, d.polyNumber * 3);
		}
	}

	// axes labels text
	let textCanvas = document.getElementById('text-canvas');
	let ctx = textCanvas.getContext('2d');
	ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
	ctx.beginPath();
	ctx.fillStyle='rgb(150,150,150)';
	ctx.textAlign = 'center';
	ctx.font = '12px Arial';
	ctx.textBaseline = 'middle';

	if(domain.showAxesLabels){
		// use the axes closest to the viewer (for each axis)
		let textNodesToDraw = [];
		for(let i of [0, 1, 2]){
			let getZ = x => simulateWebGLTranform(x.averagePt, 1, textCanvas, true).z;
			let axesContenders = globalViewPoint.textAxes.filter(x => x.axis === i);
			textNodesToDraw = textNodesToDraw.concat(
				axesContenders.sort( (a,b) => getZ(a) - getZ(b) )[0].nodes
			);
		}

		for(let textNode of textNodesToDraw){
			let transformed = simulateWebGLTranform(textNode, 1, textCanvas);
			if(transformed){
				let fontSize = transformed.height * 11;
				ctx.font = (fontSize*textNode.fontMultiplier)+'px \'Source Serif Pro\', serif';
				ctx.fillText(textNode.text, transformed.x, transformed.y);
			}
		}
		ctx.fill();
	}

	if(domain.setUpDownload){
		setUpDownload();
	}
}

// for 2d context text rendering
// simulates clipspace rendering in index.html GLSL files
function simulateWebGLTranform(pt, height, canvas, ignoreOutOfBounds){
	let centered = sub(pt, globalViewPoint.center);
	let rotated = add(add(scalar(centered.x, axes[0]), scalar(centered.y, axes[1])), scalar(centered.z, axes[2]));
	let clipspace = scalar(1/(1.75 * (globalViewPoint.x.max - globalViewPoint.x.min)/2), rotated);
	clipspace.x /= globalViewPoint.aspectRatio;
	clipspace.z += .3;

	let shrinkFactor = domain.perspective ? (clipspace.z + 1.0) / 2.0 + 0.10 : .6;

	clipspace.x /= shrinkFactor;
	clipspace.y /= shrinkFactor;
	clipspace.z /= shrinkFactor;

	if((clipspace.z < -1 || clipspace.z > 1) && !ignoreOutOfBounds){
		// out of bounds (don't show)
		return null;
	}

	return {
		x:canvas.width * (clipspace.x + 1) / 2,
		// flip the y axis
		y:canvas.height - canvas.height * (clipspace.y + 1) / 2,
		z:clipspace.z,
		height: height / shrinkFactor
	};
}

function simulateWebGLClipspace(pt){
	let centered = sub(pt, globalViewPoint.center);
	let rotated = add(add(scalar(centered.x, axes[0]), scalar(centered.y, axes[1])), scalar(centered.z, axes[2]));
	let clipspace = scalar(1/(1.75 * (globalViewPoint.x.max - globalViewPoint.x.min)/2), rotated);
	clipspace.x /= globalViewPoint.aspectRatio;
	clipspace.z += .3;

	let shrinkFactor = domain.perspective ? (clipspace.z + 1.0) / 2.0 + 0.10 : .6;

	return {
		clipspace:clipspace,
		w: shrinkFactor
	}
}

// inverse of simulateWebGLClipspace
function inverseClipspace(clip){
	clip.z -= .3;
	clip.x *= globalViewPoint.aspectRatio;
	let rotated = scalar(1.75 * (globalViewPoint.x.max - globalViewPoint.x.min)/2, clip);
	// now we have a solid system of 3 equations with 3 variables...
	// we have centered.x * axes[0] + centered.y * axes[1] + centered.z * axes[2] = rotated
	// {
	//   centered.x*axes[0].x + centered.y*axes[1].x + centered.z*axes[2].x = rotated.x
	//   centered.x*axes[0].y + centered.y*axes[1].y + centered.z*axes[2].y = rotated.y
	//   centered.x*axes[0].z + centered.y*axes[1].z + centered.z*axes[2].z = rotated.z
	// }
	// conveniently, math.js has an inverse matrix function, so I'm in luck!
	let inverse = math.inv([
		[axes[0].x, axes[0].y, axes[0].z],
		[axes[1].x, axes[1].y, axes[1].z],
		[axes[2].x, axes[2].y, axes[2].z]
	]);
	let [centeredx, centeredy, centeredz] = math.multiply([rotated.x, rotated.y, rotated.z], inverse);
	let centered = {x: centeredx, y: centeredy, z: centeredz};
	let pt = add(centered, globalViewPoint.center);
	return pt;
}

function rotatePoints(pQuats, rot){
    for(var k = 0; k < pQuats.length; k++){
        rotate(pQuats[k],rot, {x:0,y:0,z:0});
    }
}

function rotate(point,rotQuat, rotCenter){
    const center = rotCenter ? rotCenter : globalViewPoint.center;
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

// thanks to Jason on stack overflow
// https://stackoverflow.com/questions/985272/selecting-text-in-an-element-akin-to-highlighting-with-your-mouse
function selectText(element) {
    var doc = document,
		text = doc.getElementById(element),
		range, selection;

    if (doc.body.createTextRange) {
        range = document.body.createTextRange();
        range.moveToElementText(text);
        range.select();
    } else if (window.getSelection) {
        selection = window.getSelection();
        range = document.createRange();
        range.selectNodeContents(text);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

// thanks to Mohsen over at stack overflow
// https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
function rgbToHsl(r, g, b){
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    }else{
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
}
