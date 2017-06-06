function download(l,k,f){function c(e){var d=e.split(/[:;,]/),e=d[1],d=("base64"==d[2]?atob:decodeURIComponent)(d.pop()),b=d.length,q=0,o=new Uint8Array(b);for(q;q<b;++q)o[q]=d.charCodeAt(q);return new m([o],{type:e})}function i(d,b){if("download"in h)return h.href=d,h.setAttribute("download",e),h.innerHTML="downloading...",h.style.display="none",a.body.appendChild(h),setTimeout(function(){h.click();a.body.removeChild(h);!0===b&&setTimeout(function(){g.URL.revokeObjectURL(h.href)},250)},66),!0;var o=
a.createElement("iframe");a.body.appendChild(o);b||(d="data:"+d.replace(/^data:([\w\/\-\+]+)/,j));o.src=d;setTimeout(function(){a.body.removeChild(o)},333)}var g=window,j="application/octet-stream",f=f||j,a=document,h=a.createElement("a"),r=function(e){return""+e},m=g.Blob||g.MozBlob||g.WebKitBlob||r,b=g.MSBlobBuilder||g.WebKitBlobBuilder||g.BlobBuilder,e=k||"download",d;"true"===""+this&&(l=[l,f],f=l[0],l=l[1]);if((""+l).match(/^data\:[\w+\-]+\/[\w+\-]+[,;]/))return navigator.msSaveBlob?navigator.msSaveBlob(c(l),
e):i(l);try{d=l instanceof m?l:new m([l],{type:f})}catch(o){b&&(d=new b,d.append([l]),d=d.getBlob(f))}if(navigator.msSaveBlob)return navigator.msSaveBlob(d,e);if(g.URL)i(g.URL.createObjectURL(d),!0);else{if("string"===typeof d||d.constructor===r)try{return i("data:"+f+";base64,"+g.btoa(d))}catch(z){return i("data:"+f+","+encodeURIComponent(d))}k=new FileReader;k.onload=function(){i(this.result)};k.readAsDataURL(d)}return!0};window.Whammy=function(){function l(b,e){for(var d=k(b),d=[{id:440786851,data:[{data:1,id:17030},{data:1,id:17143},{data:4,id:17138},{data:8,id:17139},{data:"webm",id:17026},{data:2,id:17031},{data:2,id:17029}]},{id:408125543,data:[{id:357149030,data:[{data:1E6,id:2807729},{data:"whammy",id:19840},{data:"whammy",id:22337},{data:r(d.duration),id:17545}]},{id:374648427,data:[{id:174,data:[{data:1,id:215},{data:1,id:29637},{data:0,id:156},{data:"und",id:2274716},{data:"V_VP8",id:134},{data:"VP8",id:2459272},
{data:1,id:131},{id:224,data:[{data:d.width,id:176},{data:d.height,id:186}]}]}]},{id:475249515,data:[]}]}],o=d[1],a=o.data[2],c=0,g=0;c<b.length;){var h={id:187,data:[{data:Math.round(g),id:179},{id:183,data:[{data:1,id:247},{data:0,size:8,id:241}]}]};a.data.push(h);var q=[],h=0;do q.push(b[c]),h+=b[c].duration,c++;while(c<b.length&&3E4>h);var f=0,q={id:524531317,data:[{data:Math.round(g),id:231}].concat(q.map(function(e){var d=j({discardable:0,frame:e.data.slice(4),invisible:0,keyframe:1,lacing:0,
trackNum:1,timecode:Math.round(f)});f+=e.duration;return{data:d,id:163}}))};o.data.push(q);g+=h}for(g=c=0;g<o.data.length;g++)3<=g&&(a.data[g-3].data[1].data[1].data=c),h=i([o.data[g]],e),c+=h.size||h.byteLength||h.length,2!=g&&(o.data[g]=h);return i(d,e)}function k(b){for(var e=b[0].width,d=b[0].height,o=b[0].duration,a=1;a<b.length;a++){if(b[a].width!=e)throw"Frame "+(a+1)+" has a different width";if(b[a].height!=d)throw"Frame "+(a+1)+" has a different height";if(0>b[a].duration||32767<b[a].duration)throw"Frame "+
(a+1)+" has a weird duration (must be between 0 and 32767)";o+=b[a].duration}return{duration:o,width:e,height:d}}function f(b){for(var e=[];0<b;)e.push(b&255),b>>=8;return new Uint8Array(e.reverse())}function c(b){for(var e=[],b=(b.length%8?Array(9-b.length%8).join("0"):"")+b,d=0;d<b.length;d+=8)e.push(parseInt(b.substr(d,8),2));return new Uint8Array(e)}function i(b,e){for(var d=[],o=0;o<b.length;o++)if("id"in b[o]){var a=b[o].data;"object"==typeof a&&(a=i(a,e));if("number"==typeof a)if("size"in b[o]){for(var h=
b[o].size,j=new Uint8Array(h),h=h-1;0<=h;h--)j[h]=a&255,a>>=8;a=j}else a=c(a.toString(2));if("string"==typeof a){j=new Uint8Array(a.length);for(h=0;h<a.length;h++)j[h]=a.charCodeAt(h);a=j}for(var h=a.size||a.byteLength||a.length,j=0,m=56;0<m;m-=7)if(h>Math.pow(2,m)-2){j=m/7;break}h=h.toString(2);m=Array(8*(j+1)+1).join("0");j=Array(j+1).join("0")+1;h=m.substr(0,m.length-h.length-j.length)+h;j+=h;d.push(f(b[o].id));d.push(c(j));d.push(a)}else d.push(b[o]);return e?(d=g(d),new Uint8Array(d)):new Blob(d,
{type:"video/webm"})}function g(b,e){null==e&&(e=[]);for(var d=0;d<b.length;d++)"object"==typeof b[d]?g(b[d],e):e.push(b[d]);return e}function j(b){var e=0;b.keyframe&&(e|=128);b.invisible&&(e|=8);b.lacing&&(e|=b.lacing<<1);b.discardable&&(e|=1);if(127<b.trackNum)throw"TrackNumber > 127 not supported";return[b.trackNum|128,b.timecode>>8,b.timecode&255,e].map(function(e){return String.fromCharCode(e)}).join("")+b.frame}function a(b){for(var e=b.RIFF[0].WEBP[0],d=e.indexOf("\u009d\u0001*"),a=0,h=[];4>
a;a++)h[a]=e.charCodeAt(d+3+a);a=h[1]<<8|h[0];d=a&16383;a=h[3]<<8|h[2];return{width:d,height:a&16383,data:e,riff:b}}function h(b){for(var e=0,d={};e<b.length;){var a=b.substr(e,4);d[a]=d[a]||[];if("RIFF"==a||"LIST"==a){var c=parseInt(b.substr(e+4,4).split("").map(function(e){e=e.charCodeAt(0).toString(2);return Array(8-e.length+1).join("0")+e}).join(""),2),g=b.substr(e+4+4,c),e=e+(8+c);d[a].push(h(g))}else"WEBP"==a?d[a].push(b.substr(e+8)):d[a].push(b.substr(e+4)),e=b.length}return d}function r(a){return[].slice.call(new Uint8Array((new Float64Array([a])).buffer),
0).map(function(e){return String.fromCharCode(e)}).reverse().join("")}function m(a,e){this.frames=[];this.duration=1E3/a;this.quality=e||0.8}m.prototype.add=function(a,e){if("undefined"!=typeof e&&this.duration)throw"you can't pass a duration if the fps is set";if("undefined"==typeof e&&!this.duration)throw"if you don't have the fps set, you need to have durations here.";a.canvas&&(a=a.canvas);if(a.toDataURL)a=a.getContext("2d").getImageData(0,0,a.width,a.height);else if("string"!=typeof a)throw"frame must be a a HTMLCanvasElement, a CanvasRenderingContext2D or a DataURI formatted string";
if("string"===typeof a&&!/^data:image\/webp;base64,/ig.test(a))throw"Input must be formatted properly as a base64 encoded DataURI of type image/webp";this.frames.push({image:a,duration:e||this.duration})};m.prototype.encodeFrames=function(a){if(this.frames[0].image instanceof ImageData){var e=this.frames,d=document.createElement("canvas"),h=d.getContext("2d");d.width=this.frames[0].image.width;d.height=this.frames[0].image.height;var c=function(g){var j=e[g];h.putImageData(j.image,0,0);j.image=d.toDataURL("image/webp",
this.quality);g<e.length-1?setTimeout(function(){c(g+1)},1):a()}.bind(this);c(0)}else a()};m.prototype.compile=function(b,e){this.encodeFrames(function(){var d=new l(this.frames.map(function(e){var d=a(h(atob(e.image.slice(23))));d.duration=e.duration;return d}),b);e(d)}.bind(this))};return{Video:m,fromImageArray:function(b,e,d){return l(b.map(function(d){d=a(h(atob(d.slice(23))));d.duration=1E3/e;return d}),d)},toWebM:l}}();(function(){function l(f){var c,i=new Uint8Array(f);for(c=0;c<f;c+=1)i[c]=0;return i}var k="A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9,+,/".split(",");window.utils={};window.utils.clean=l;window.utils.pad=function(f,c,i){f=f.toString(i||8);return"000000000000".substr(f.length+12-c)+f};window.utils.extend=function(f,c,i,g){c=l((parseInt((c+i)/g)+1)*g);c.set(f);return c};window.utils.stringToUint8=function(f,c,i){var g,
j,c=c||l(f.length),i=i||0;for(g=0,j=f.length;g<j;g+=1)c[i]=f.charCodeAt(g),i+=1;return c};window.utils.uint8ToBase64=function(f){var c,i=f.length%3,g="",j;for(c=0,j=f.length-i;c<j;c+=3)i=(f[c]<<16)+(f[c+1]<<8)+f[c+2],g+=k[i>>18&63]+k[i>>12&63]+k[i>>6&63]+k[i&63];switch(g.length%4){case 1:g+="=";break;case 2:g+="=="}return g}})();
(function(){var l=window.utils,k;k=[{field:"fileName",length:100},{field:"fileMode",length:8},{field:"uid",length:8},{field:"gid",length:8},{field:"fileSize",length:12},{field:"mtime",length:12},{field:"checksum",length:8},{field:"type",length:1},{field:"linkName",length:100},{field:"ustar",length:8},{field:"owner",length:32},{field:"group",length:32},{field:"majorNumber",length:8},{field:"minorNumber",length:8},{field:"filenamePrefix",length:155},{field:"padding",length:12}];window.header={};window.header.structure=
k;window.header.format=function(f,c){var i=l.clean(512),g=0;k.forEach(function(c){var a=f[c.field]||"",h,r;for(h=0,r=a.length;h<r;h+=1)i[g]=a.charCodeAt(h),g+=1;g+=c.length-h});return"function"===typeof c?c(i,g):i}})();
(function(){function l(g){this.written=0;i=(g||20)*c;this.out=f.clean(i);this.blocks=[];this.length=0}var k=window.header,f=window.utils,c=512,i;l.prototype.append=function(g,j,a){var h,i,m,b,e,d;if("string"===typeof j)j=f.stringToUint8(j);else if(j.constructor!==Uint8Array.prototype.constructor)throw"Invalid input type. You gave me: "+j.constructor.toString().match(/function\s*([$A-Za-z_][0-9A-Za-z_]*)\s*\(/)[1];"function"===typeof a&&(a={});a=a||{};m=a.mode||511;b=a.mtime||Math.floor(+new Date/
1E3);e=a.uid||0;d=a.gid||0;h={fileName:g,fileMode:f.pad(m,7),uid:f.pad(e,7),gid:f.pad(d,7),fileSize:f.pad(j.length,11),mtime:f.pad(b,11),checksum:"        ",type:"0",ustar:"ustar  ",owner:a.owner||"",group:a.group||""};i=0;Object.keys(h).forEach(function(e){var d=h[e],a;for(e=0,a=d.length;e<a;e+=1)i+=d.charCodeAt(e)});h.checksum=f.pad(i,6)+"\x00 ";g=k.format(h);a=Math.ceil(g.length/c)*c;m=Math.ceil(j.length/c)*c;this.blocks.push({header:g,input:j,headerLength:a,inputLength:m})};l.prototype.save=function(){var g=
[],i=[],a=0,h=Math.pow(2,20),f=[];this.blocks.forEach(function(c){a+c.headerLength+c.inputLength>h&&(i.push({blocks:f,length:a}),f=[],a=0);f.push(c);a+=c.headerLength+c.inputLength});i.push({blocks:f,length:a});i.forEach(function(a){var b=new Uint8Array(a.length),e=0;a.blocks.forEach(function(d){b.set(d.header,e);e+=d.headerLength;b.set(d.input,e);e+=d.inputLength});g.push(b)});g.push(new Uint8Array(2*c));return new Blob(g,{type:"octet/stream"})};l.prototype.clear=function(){this.written=0;this.out=
f.clean(i)};window.Tar=l})();(function(l){function k(c,i){if({}.hasOwnProperty.call(k.cache,c))return k.cache[c];var g=k.resolve(c);if(!g)throw Error("Failed to resolve module "+c);var f={id:c,require:k,filename:c,exports:{},loaded:!1,parent:i,children:[]};i&&i.children.push(f);var a=c.slice(0,c.lastIndexOf("/")+1);return k.cache[c]=f.exports,g.call(f.exports,f,f.exports,a,c),f.loaded=!0,k.cache[c]=f.exports}k.modules={};k.cache={};k.resolve=function(c){return{}.hasOwnProperty.call(k.modules,c)?k.modules[c]:void 0};k.define=
function(c,f){k.modules[c]=f};var f=function(c){return c="/",{title:"browser",version:"v0.10.26",browser:!0,env:{},argv:[],nextTick:l.setImmediate||function(c){setTimeout(c,0)},cwd:function(){return c},chdir:function(f){c=f}}}();k.define("/gif.coffee",function(c){function f(a,b){function e(){this.constructor=a}for(var d in b)({}).hasOwnProperty.call(b,d)&&(a[d]=b[d]);return e.prototype=b.prototype,a.prototype=new e,a.__super__=b.prototype,a}var g,j,a,h,l;a=k("events",c).EventEmitter;g=k("/browser.coffee",
c);l=function(a){function b(e){var a,b;this.running=!1;this.options={};this.frames=[];this.freeWorkers=[];this.activeWorkers=[];this.setOptions(e);for(a in j)b=j[a],null!=this.options[a]||(this.options[a]=b)}return f(b,a),j={workerScript:"gif.worker.js",workers:2,repeat:0,background:"#fff",quality:10,width:null,height:null,transparent:null},h={delay:500,copy:!1},b.prototype.setOption=function(e,a){return this.options[e]=a,null!=this._canvas&&("width"===e||"height"===e)?this._canvas[e]=a:void 0},b.prototype.setOptions=
function(e){var a,b,h=[];for(a in e)({}).hasOwnProperty.call(e,a)&&(b=e[a],h.push(this.setOption(a,b)));return h},b.prototype.addFrame=function(a,d){var b,c;null==d&&(d={});b={};b.transparent=this.options.transparent;for(c in h)b[c]=d[c]||h[c];if(null!=this.options.width||this.setOption("width",a.width),null!=this.options.height||this.setOption("height",a.height),"undefined"!==typeof ImageData&&null!=ImageData&&a instanceof ImageData)b.data=a.data;else if("undefined"!==typeof CanvasRenderingContext2D&&
null!=CanvasRenderingContext2D&&a instanceof CanvasRenderingContext2D||"undefined"!==typeof WebGLRenderingContext&&null!=WebGLRenderingContext&&a instanceof WebGLRenderingContext)d.copy?b.data=this.getContextData(a):b.context=a;else if(null!=a.childNodes)d.copy?b.data=this.getImageData(a):b.image=a;else throw Error("Invalid image");return this.frames.push(b)},b.prototype.render=function(){var a;if(this.running)throw Error("Already running");if(!(null!=this.options.width&&null!=this.options.height))throw Error("Width and height must be set prior to rendering");
this.running=!0;this.nextFrame=0;this.finishedFrames=0;this.imageParts=function(a){for(var e=0,d=function(){var a;a=[];for(var e=0;0<=this.frames.length?e<this.frames.length:e>this.frames.length;0<=this.frames.length?++e:--e)a.push(e);return a}.apply(this,arguments).length;e<d;++e)a.push(null);return a}.call(this,[]);a=this.spawnWorkers();for(var d=0,b=function(){var d;d=[];for(var b=0;0<=a?b<a:b>a;0<=a?++b:--b)d.push(b);return d}.apply(this,arguments).length;d<b;++d)this.renderNextFrame();return this.emit("start"),
this.emit("progress",0)},b.prototype.abort=function(){for(var a;!(a=this.activeWorkers.shift(),null==a);){console.log("killing active worker");a.terminate()}return this.running=!1,this.emit("abort")},b.prototype.spawnWorkers=function(){var a;return a=Math.min(this.options.workers,this.frames.length),function(){var d;d=[];for(var b=this.freeWorkers.length;this.freeWorkers.length<=a?b<a:b>a;this.freeWorkers.length<=a?++b:--b)d.push(b);return d}.apply(this,arguments).forEach(function(a){return function(e){var b;
return console.log("spawning worker "+e),b=new Worker(a.options.workerScript),b.onmessage=function(a){return function(e){return a.activeWorkers.splice(a.activeWorkers.indexOf(b),1),a.freeWorkers.push(b),a.frameFinished(e.data)}}(a),a.freeWorkers.push(b)}}(this)),a},b.prototype.frameFinished=function(a){console.log("frame "+a.index+" finished - "+this.activeWorkers.length+" active");this.finishedFrames++;this.emit("progress",this.finishedFrames/this.frames.length);this.imageParts[a.index]=a;a:{for(var a=
this.imageParts,d=0,b=a.length;d<b;++d)if(d in a&&null===a[d]){a=!0;break a}a=!1}return a?this.renderNextFrame():this.finishRendering()},b.prototype.finishRendering=function(){var a,d,b,h,c,g,f;a=c=0;for(g=this.imageParts.length;a<g;++a)d=this.imageParts[a],c+=(d.data.length-1)*d.pageSize+d.cursor;c+=d.pageSize-d.cursor;console.log("rendering finished - filesize "+Math.round(c/1E3)+"kb");a=new Uint8Array(c);g=0;c=0;for(var q=this.imageParts.length;c<q;++c){d=this.imageParts[c];for(var i=0,j=d.data.length;i<
j;++i)f=d.data[i],b=i,a.set(f,g),b===d.data.length-1?g+=d.cursor:g+=d.pageSize}return h=new Blob([a],{type:"image/gif"}),this.emit("finished",h,a)},b.prototype.renderNextFrame=function(){var a,b,c;if(0===this.freeWorkers.length)throw Error("No free workers");return this.nextFrame>=this.frames.length?void 0:(a=this.frames[this.nextFrame++],c=this.freeWorkers.shift(),b=this.getTask(a),console.log("starting frame "+(b.index+1)+" of "+this.frames.length),this.activeWorkers.push(c),c.postMessage(b))},
b.prototype.getContextData=function(a){return a.getImageData(0,0,this.options.width,this.options.height).data},b.prototype.getImageData=function(a){var b;return null!=this._canvas||(this._canvas=document.createElement("canvas"),this._canvas.width=this.options.width,this._canvas.height=this.options.height),b=this._canvas.getContext("2d"),b.setFill=this.options.background,b.fillRect(0,0,this.options.width,this.options.height),b.drawImage(a,0,0),this.getContextData(b)},b.prototype.getTask=function(a){var b,
c;if(b=this.frames.indexOf(a),c={index:b,last:b===this.frames.length-1,delay:a.delay,transparent:a.transparent,width:this.options.width,height:this.options.height,quality:this.options.quality,repeat:this.options.repeat,canTransfer:"chrome"===g.name},null!=a.data)c.data=a.data;else if(null!=a.context)c.data=this.getContextData(a.context);else if(null!=a.image)c.data=this.getImageData(a.image);else throw Error("Invalid frame");return c},b}(a);c.exports=l});k.define("/browser.coffee",function(c){var f,
g,j,a,h;a=navigator.userAgent.toLowerCase();j=navigator.platform.toLowerCase();h=a.match(/(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/)||[null,"unknown",0];g="ie"===h[1]&&document.documentMode;f={name:"version"===h[1]?h[3]:h[1],version:g||parseFloat("opera"===h[1]&&h[4]?h[4]:h[2]),platform:{name:a.match(/ip(?:ad|od|hone)/)?"ios":(a.match(/(?:webos|android)/)||j.match(/mac|win|linux/)||["other"])[0]}};f[f.name]=!0;f[f.name+parseInt(f.version,10)]=!0;
f.platform[f.platform.name]=!0;c.exports=f});k.define("events",function(c,i){f.EventEmitter||(f.EventEmitter=function(){});var g=i.EventEmitter=f.EventEmitter,j="function"===typeof Array.isArray?Array.isArray:function(a){return"[object Array]"===Object.prototype.toString.call(a)};g.prototype.setMaxListeners=function(a){this._events||(this._events={});this._events.maxListeners=a};g.prototype.emit=function(a){if("error"===a&&(!this._events||!this._events.error||j(this._events.error)&&!this._events.error.length))throw arguments[1]instanceof
Error?arguments[1]:Error("Uncaught, unspecified 'error' event.");if(!this._events)return!1;var c=this._events[a];if(!c)return!1;if("function"!=typeof c){if(j(c)){for(var f=Array.prototype.slice.call(arguments,1),c=c.slice(),g=0,b=c.length;g<b;g++)c[g].apply(this,f);return!0}return!1}switch(arguments.length){case 1:c.call(this);break;case 2:c.call(this,arguments[1]);break;case 3:c.call(this,arguments[1],arguments[2]);break;default:f=Array.prototype.slice.call(arguments,1),c.apply(this,f)}return!0};
g.prototype.addListener=function(a,c){if("function"!==typeof c)throw Error("addListener only takes instances of Function");if(this._events||(this._events={}),this.emit("newListener",a,c),!this._events[a])this._events[a]=c;else if(j(this._events[a])){if(!this._events[a].warned){var f;void 0!==this._events.maxListeners?f=this._events.maxListeners:f=10;f&&0<f&&this._events[a].length>f&&(this._events[a].warned=!0,console.error("(node) warning: possible EventEmitter memory leak detected. %d listeners added. Use emitter.setMaxListeners() to increase limit.",
this._events[a].length),console.trace())}this._events[a].push(c)}else this._events[a]=[this._events[a],c];return this};g.prototype.on=g.prototype.addListener;g.prototype.once=function(a,c){var f=this;return f.on(a,function b(){f.removeListener(a,b);c.apply(this,arguments)}),this};g.prototype.removeListener=function(a,c){if("function"!==typeof c)throw Error("removeListener only takes instances of Function");if(!this._events||!this._events[a])return this;var f=this._events[a];if(j(f)){var g=f.indexOf(c);
if(0>g)return this;f.splice(g,1);0==f.length&&delete this._events[a]}else this._events[a]===c&&delete this._events[a];return this};g.prototype.removeAllListeners=function(a){return a&&this._events&&this._events[a]&&(this._events[a]=null),this};g.prototype.listeners=function(a){return this._events||(this._events={}),this._events[a]||(this._events[a]=[]),j(this._events[a])||(this._events[a]=[this._events[a]]),this._events[a]}});l.GIF=k("/gif.coffee")}).call(this,this);(function(){function l(a){return a&&a.Object===Object?a:null}function k(){function a(){return Math.floor(65536*(1+Math.random())).toString(16).substring(1)}return a()+a()+"-"+a()+"-"+a()+"-"+a()+"-"+a()+a()+a()}function f(a){var b={};this.settings=a;this.on=function(a,c){b[a]=c};this.emit=function(a){var c=b[a];c&&c.apply(null,Array.prototype.slice.call(arguments,1))};this.filename=a.name||k();this.mimeType=this.extension=""}function c(a){f.call(this,a);this.extension=".tar";this.mimeType="application/x-tar";
this.fileExtension="";this.tape=null;this.count=0}function i(a){c.call(this,a);this.type="image/png";this.fileExtension=".png"}function g(a){c.call(this,a);this.type="image/jpeg";this.fileExtension=".jpg";this.quality=a.quality/100||0.8}function j(a){"image/webp"!==document.createElement("canvas").toDataURL("image/webp").substr(5,10)&&console.log("WebP not supported - try another export format");f.call(this,a);a.quality=a.quality/100||0.8;this.extension=".webm";this.mimeType="video/webm";this.baseFilename=
this.filename;this.frames=[];this.part=1}function a(a){f.call(this,a);a.quality=a.quality/100||0.8;this.encoder=new FFMpegServer.Video(a);this.encoder.on("process",function(){this.emit("process")}.bind(this));this.encoder.on("finished",function(a,b){var c=this.callback;c&&(this.callback=void 0,c(a,b))}.bind(this));this.encoder.on("progress",function(a){if(this.settings.onProgress)this.settings.onProgress(a)}.bind(this));this.encoder.on("error",function(a){alert(JSON.stringify(a,null,2))}.bind(this))}
function h(a){f.call(this,a);this.framerate=this.settings.framerate;this.type="video/webm";this.extension=".webm";this.mediaRecorder=this.stream=null;this.chunks=[]}function r(a){f.call(this,a);a.quality=31-(30*a.quality/100||10);a.workers=a.workers||4;this.extension=".gif";this.mimeType="image/gif";this.canvas=document.createElement("canvas");this.ctx=this.canvas.getContext("2d");this.sizeSet=!1;this.encoder=new GIF({workers:a.workers,quality:1,workerScript:a.workersPath+"gif.worker.js"});
this.encoder.on("progress",function(a){if(this.settings.onProgress)this.settings.onProgress(a)}.bind(this));this.encoder.on("finished",function(a){var b=this.callback;b&&(this.callback=void 0,b(a))}.bind(this))}function m(b){function c(){function a(){this._hooked||(this._hooked=!0,this._hookedTime=this.currentTime||0,this.pause(),K.push(this));return this._hookedTime+n.startTime}m("Capturer start");y=window.Date.now();v=y+n.startTime;G=window.performance.now();H=G+n.startTime;window.Date.prototype.getTime=
function(){return v};window.Date.now=function(){return v};window.setTimeout=function(a,b){var c={callback:a,time:b,triggerTime:v+b};x.push(c);m("Timeout set to "+c.time);return c};window.clearTimeout=function(a){for(var b=0;b<x.length;b++)x[b]==a&&(x.splice(b,1),m("Timeout cleared"))};window.setInterval=function(a,b){var c={callback:a,time:b,triggerTime:v+b};A.push(c);m("Interval set to "+c.time);return c};window.clearInterval=function(){m("clear Interval");return null};window.requestAnimationFrame=
function(a){I.push(a)};window.performance.now=function(){return H};Object.defineProperty(HTMLVideoElement.prototype,"currentTime",{get:a, configurable:true});Object.defineProperty(HTMLAudioElement.prototype,"currentTime",{get:a,configurable:true})}function d(){J=!1;s.stop();m("Capturer stop");window.setTimeout=E;window.setInterval=O;window.clearTimeout=P;window.requestAnimationFrame=Q;window.Date.prototype.getTime=R;window.Date.now=S;window.performance.now=T}function e(){E(k,0,void 0)}function f(){var a=w/n.framerate;if(n.frameLimit&&
w>=n.frameLimit||n.timeLimit&&a>=n.timeLimit)d(),l();var b=new Date(null);b.setSeconds(a);u.textContent=2<n.motionBlurFrames?"CCapture "+n.format+" | "+w+" frames ("+B+" inter) | "+b.toISOString().substr(11,8):"CCapture "+n.format+" | "+w+" frames | "+b.toISOString().substr(11,8)}function k(){var a=(w+B/n.motionBlurFrames)*(1E3/n.framerate);v=y+a;H=G+a;K.forEach(function(b){b._hookedTime=a/1E3});f();m("Frame: "+w+" "+B);for(var b=0;b<x.length;b++)v>=x[b].triggerTime&&(E(x[b].callback,0,void 0),x.splice(b,
1));for(b=0;b<A.length;b++)v>=A[b].triggerTime&&(E(A[b].callback,0,void 0),A[b].triggerTime+=A[b].time);I.forEach(function(a){E(a,0,v-N)});I=[]}function l(a){a||(a=function(a){download(a,s.filename+s.extension,s.mimeType);return!1});s.save(a)}function m(a){z&&console.log(a)}function o(a){var b=D[a];b&&b.apply(null,Array.prototype.slice.call(arguments,1))}var n=b||{},z,v,y,H,G,s,x=[],A=[],w=0,B=0,I=[],J=!1,D={};n.framerate=n.framerate||60;n.motionBlurFrames=2*(n.motionBlurFrames||1);z=n.verbose||!1;
n.step=1E3/n.framerate;n.timeLimit=n.timeLimit||0;n.frameLimit=n.frameLimit||0;n.startTime=n.startTime||0;var u=document.createElement("div");u.style.position="absolute";u.style.left=u.style.top=0;u.style.backgroundColor="black";u.style.fontFamily="monospace";u.style.fontSize="11px";u.style.padding="5px";u.style.color="red";u.style.zIndex=1E5;n.display&&document.body.appendChild(u);var t=document.createElement("canvas"),F=t.getContext("2d"),p,C;m("Step is set to "+n.step+"ms");var b={gif:r,webm:j,
ffmpegserver:a,png:i,jpg:g,"webm-mediarecorder":h},L=b[n.format];if(!L)throw"Error: Incorrect or missing format: Valid formats are "+Object.keys(b).join(", ");s=new L(n);s.step=e;s.on("process",k);s.on("progress",function(a){o("progress",a)});!1=="performance"in window&&(window.performance={});Date.now=Date.now||function(){return(new Date).getTime()};if(!1=="now"in window.performance){var M=Date.now();performance.timing&&performance.timing.navigationStart&&(M=performance.timing.navigationStart);window.performance.now=
function(){return Date.now()-M}}var E=window.setTimeout,O=window.setInterval,P=window.clearTimeout,Q=window.requestAnimationFrame,S=window.Date.now,T=window.performance.now,R=window.Date.prototype.getTime,K=[];return{start:function(){c();s.start();J=!0},capture:function(a){if(J)if(2<n.motionBlurFrames){if(t.width!==a.width||t.height!==a.height)t.width=a.width,t.height=a.height,p=new Uint16Array(4*t.height*t.width),F.fillStyle="#0",F.fillRect(0,0,t.width,t.height);F.drawImage(a,0,0);C=F.getImageData(0,
0,t.width,t.height);for(a=0;a<p.length;a+=4)p[a]+=C.data[a],p[a+1]+=C.data[a+1],p[a+2]+=C.data[a+2];B++;if(B>=0.5*n.motionBlurFrames){for(var a=C.data,b=0;b<p.length;b+=4)a[b]=2*p[b]/n.motionBlurFrames,a[b+1]=2*p[b+1]/n.motionBlurFrames,a[b+2]=2*p[b+2]/n.motionBlurFrames;F.putImageData(C,0,0);s.add(t);w++;B=0;m("Full MB Frame! "+w+" "+v);for(b=0;b<p.length;b+=4)p[b]=0,p[b+1]=0,p[b+2]=0;gc()}else e()}else s.add(a),w++,m("Full Frame! "+w)},stop:d,save:l,on:function(a,b){D[a]=b}}}var b={"function":!0,
object:!0},e=b[typeof exports]&&exports&&!exports.nodeType?exports:void 0,d=b[typeof module]&&module&&!module.nodeType?module:void 0,o=d&&d.exports===e?e:void 0,z=l(e&&d&&"object"==typeof global&&global),D=l(b[typeof self]&&self),y=l(b[typeof window]&&window),b=l(b[typeof this]&&this),z=z||y!==(b&&b.window)&&y||D||b||Function("return this")();"gc"in window||(window.gc=function(){});HTMLCanvasElement.prototype.toBlob||Object.defineProperty(HTMLCanvasElement.prototype,"toBlob",{value:function(a,b,c){for(var c=
atob(this.toDataURL(b,c).split(",")[1]),d=c.length,e=new Uint8Array(d),f=0;f<d;f++)e[f]=c.charCodeAt(f);a(new Blob([e],{type:b||"image/png"}))}});(function(){!1=="performance"in window&&(window.performance={});Date.now=Date.now||function(){return(new Date).getTime()};if(!1=="now"in window.performance){var a=Date.now();performance.timing&&performance.timing.navigationStart&&(a=performance.timing.navigationStart);window.performance.now=function(){return Date.now()-a}}})();var N=window.Date.now();f.prototype.start=
function(){};f.prototype.stop=function(){};f.prototype.add=function(){};f.prototype.save=function(){};f.prototype.dispose=function(){};f.prototype.safeToProceed=function(){return!0};f.prototype.step=function(){console.log("Step not set!")};c.prototype=Object.create(f.prototype);c.prototype.start=function(){this.dispose()};c.prototype.add=function(a){var b=new FileReader;b.onload=function(){this.tape.append(("0000000"+this.count).slice(-7)+this.fileExtension,new Uint8Array(b.result));this.count++;
this.step()}.bind(this);b.readAsArrayBuffer(a)};c.prototype.save=function(a){a(this.tape.save())};c.prototype.dispose=function(){this.tape=new Tar;this.count=0};i.prototype=Object.create(c.prototype);i.prototype.add=function(a){a.toBlob(function(a){c.prototype.add.call(this,a)}.bind(this),this.type)};g.prototype=Object.create(c.prototype);g.prototype.add=function(a){a.toBlob(function(a){c.prototype.add.call(this,a)}.bind(this),this.type,this.quality)};j.prototype=Object.create(f.prototype);j.prototype.start=
function(){this.dispose()};j.prototype.add=function(a){this.frames.push(a.toDataURL("image/webp",this.quality));this.settings.progress();0<this.settings.autoSaveTime&&this.frames.length/this.settings.framerate>=this.settings.autoSaveTime?this.save(function(a){this.filename=this.baseFilename+"-part-"+("0000000"+this.part).slice(-7);download(a,this.filename+this.extension,this.mimeType);this.dispose();this.part++;this.filename=this.baseFilename+"-part-"+("0000000"+this.part).slice(-7);this.step()}.bind(this)):this.step()};
j.prototype.save=function(a){if(this.frames.length){var b=Whammy.fromImageArray(this.frames,this.settings.framerate),b=new Blob([b],{type:"octet/stream"});a(b)}};j.prototype.dispose=function(){this.frames=[]};a.prototype=Object.create(f.prototype);a.prototype.start=function(){this.encoder.start(this.settings)};a.prototype.add=function(a){this.encoder.add(a)};a.prototype.save=function(a){this.callback=a;this.encoder.end()};a.prototype.safeToProceed=function(){return this.encoder.safeToProceed()};h.prototype=
Object.create(f.prototype);h.prototype.add=function(a){this.stream||(this.stream=a.captureStream(this.framerate),this.mediaRecorder=new MediaRecorder(this.stream),this.mediaRecorder.start(),this.mediaRecorder.ondataavailable=function(a){this.chunks.push(a.data)}.bind(this));this.step()};h.prototype.save=function(a){this.mediaRecorder.onstop=function(){var b=new Blob(this.chunks,{type:"video/webm"});this.chunks=[];a(b)}.bind(this);this.mediaRecorder.stop()};r.prototype=Object.create(f.prototype);r.prototype.add=
function(a){this.sizeSet||(this.encoder.setOption("width",a.width),this.encoder.setOption("height",a.height),this.sizeSet=!0);this.canvas.width=a.width;this.canvas.height=a.height;this.ctx.drawImage(a,0,0);this.encoder.addFrame(this.ctx,{copy:!0,delay:this.settings.step});this.step()};r.prototype.save=function(a){this.callback=a;this.encoder.render()};(y||D||{}).CCapture=m;"function"==typeof define&&"object"==typeof define.amd&&define.amd?define(function(){return m}):e&&d?(o&&((d.exports=m).CCapture=
m),e.CCapture=m):z.CCapture=m})();