/* AROGARA chart controls — deliberately presentation-only.
   The tool never rebuilds a chart or changes engineering data. */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  var STORE = 'aro_chart_prefs_v2';
  function prefs(key) { try { return JSON.parse(localStorage.getItem(STORE) || '{}')[key] || {}; } catch (e) { return {}; } }
  function save(key, value) { try { var all = JSON.parse(localStorage.getItem(STORE) || '{}'); all[key] = value; localStorage.setItem(STORE, JSON.stringify(all)); } catch (e) {} }
  function hex(value) {
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return value;
    var m = String(value || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    return m ? '#' + [m[1],m[2],m[3]].map(function (n) { return (+n).toString(16).padStart(2, '0'); }).join('') : '#38bdf8';
  }
  function css() {
    if (document.getElementById('aro-chart-controls-css')) return;
    var style = document.createElement('style'); style.id = 'aro-chart-controls-css';
    style.textContent = '.aro-chart-host{position:relative}.aro-chart-gear{position:absolute;z-index:8;right:7px;top:7px;width:26px;height:26px;border:1px solid #94a3b8;border-radius:5px;background:#fff;color:#334155;cursor:pointer}.aro-chart-panel{position:absolute;z-index:9;right:7px;top:39px;width:244px;max-height:calc(100% - 46px);overflow:auto;overscroll-behavior:contain;box-sizing:border-box;padding:11px;background:#fff;border:1px solid #cbd5e1;border-radius:7px;box-shadow:0 10px 28px rgba(15,23,42,.22);font:11px var(--font-mono,monospace);color:#334155}.aro-chart-panel h4{margin:0 0 8px;color:#0284c7;font-size:11px}.aro-chart-panel h5{margin:10px 0 5px;padding-top:7px;border-top:1px dashed #cbd5e1;font-size:10px}.aro-chart-row{display:flex;align-items:center;gap:5px;margin:5px 0}.aro-chart-row input[type=number]{width:0;min-width:0;flex:1;padding:4px;border:1px solid #cbd5e1;border-radius:4px}.aro-chart-row input[type=color]{width:27px;height:23px;padding:0;border:1px solid #cbd5e1;border-radius:4px}.aro-chart-row span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.aro-chart-reset{width:100%;margin-top:10px;padding:6px;border:1px solid #94a3b8;border-radius:4px;background:#f8fafc;color:#475569;font:700 10px var(--font-mono,monospace);cursor:pointer}.aro-chart-readout{position:absolute;z-index:7;left:8px;bottom:7px;max-width:calc(100% - 52px);padding:4px 7px;border:1px solid #0284c7;border-radius:4px;background:rgba(255,255,255,.94);color:#0f172a;font:700 10px var(--font-mono,monospace);pointer-events:none}';
    document.head.appendChild(style);
  }
  var registered = false;
  function backgroundPlugin() {
    if (registered || typeof Chart === 'undefined') return;
    Chart.register({ id: 'aroBackground', beforeDraw: function (chart) { if (!chart.$aroBackground) return; var c = chart.ctx; c.save(); c.fillStyle = chart.$aroBackground; c.fillRect(0, 0, chart.width, chart.height); c.restore(); } });
    registered = true;
  }
  function apply(chart, key) {
    var p = prefs(key), scales = chart.options.scales || {};
    Object.keys(scales).forEach(function (id) { var v = p.scales && p.scales[id]; if (!v) return; if (v.min !== null && v.min !== undefined) scales[id].min = v.min; if (v.max !== null && v.max !== undefined) scales[id].max = v.max; });
    (p.colors || []).forEach(function (color, i) { if (color && chart.data.datasets[i]) { chart.data.datasets[i].borderColor = color; if (chart.data.datasets[i].backgroundColor) chart.data.datasets[i].backgroundColor = color; } });
    chart.$aroBackground = p.background || null;
    chart.update('none');
  }
  function panel(chart, key, host) {
    var p = prefs(key), box = document.createElement('div'); box.className = 'aro-chart-panel'; box.innerHTML = '<h4>CUSTOMIZE CHART</h4><div style="color:#64748b">Units follow the global unit selector.</div>';
    Object.keys(chart.options.scales || {}).forEach(function (id) {
      var sc = chart.scales[id], title = (chart.options.scales[id].title || {}).text || id.toUpperCase(), current = (p.scales || {})[id] || {};
      var h = document.createElement('h5'); h.textContent = title; box.appendChild(h);
      var row = document.createElement('div'); row.className = 'aro-chart-row'; row.innerHTML = '<span>MIN</span>';
      var min = document.createElement('input'); min.type='number'; min.step='any'; min.placeholder = sc && isFinite(sc.min) ? sc.min : ''; min.value = current.min == null ? '' : current.min; row.appendChild(min); row.insertAdjacentHTML('beforeend','<span>MAX</span>');
      var max = document.createElement('input'); max.type='number'; max.step='any'; max.placeholder = sc && isFinite(sc.max) ? sc.max : ''; max.value = current.max == null ? '' : current.max; row.appendChild(max); box.appendChild(row);
      function setScale() { var q=prefs(key); q.scales=q.scales||{}; q.scales[id]={min:min.value===''?null:+min.value,max:max.value===''?null:+max.value}; save(key,q); apply(chart,key); }
      min.addEventListener('change',setScale); max.addEventListener('change',setScale);
    });
    var sh = document.createElement('h5'); sh.textContent='LINE / SERIES COLOUR'; box.appendChild(sh);
    chart.data.datasets.forEach(function (ds,i) { var row=document.createElement('label'); row.className='aro-chart-row'; var input=document.createElement('input'); input.type='color'; input.value=hex((p.colors||[])[i]||ds.borderColor); var label=document.createElement('span'); label.textContent=ds.label||('Series '+(i+1)); row.appendChild(input);row.appendChild(label);box.appendChild(row); input.addEventListener('input',function(){var q=prefs(key);q.colors=q.colors||[];q.colors[i]=input.value;save(key,q);apply(chart,key);}); });
    var bh=document.createElement('h5'); bh.textContent='CHART BACKGROUND'; box.appendChild(bh); var bg=document.createElement('input'); bg.type='color'; bg.value=hex(p.background||'#ffffff'); box.appendChild(bg); bg.addEventListener('input',function(){var q=prefs(key);q.background=bg.value;save(key,q);apply(chart,key);});
    var reset=document.createElement('button');reset.type='button';reset.className='aro-chart-reset';reset.textContent='RESET TO DEFAULT';reset.onclick=function(){save(key,{});chart.$aroBackground=null;chart.options.scales=chart._aroScales;chart.data.datasets.forEach(function(ds,i){ds.borderColor=chart._aroColors[i];ds.backgroundColor=chart._aroBackgrounds[i];});chart.update();box.remove();};box.appendChild(reset); box.addEventListener('click',function(e){e.stopPropagation();}); return box;
  }
  function enhance(chart, canvas, key) {
    if (!chart || !canvas || canvas.dataset.aroChartReady) return; canvas.dataset.aroChartReady='1'; css(); backgroundPlugin(); var host=canvas.parentElement; if(!host)return; host.classList.add('aro-chart-host'); chart._aroScales=JSON.parse(JSON.stringify(chart.options.scales||{})); chart._aroColors=chart.data.datasets.map(function(d){return d.borderColor;}); chart._aroBackgrounds=chart.data.datasets.map(function(d){return d.backgroundColor;}); apply(chart,key);
    var gear=document.createElement('button');gear.type='button';gear.className='aro-chart-gear';gear.textContent='⚙';gear.title='Customize chart';host.appendChild(gear);gear.onclick=function(e){e.stopPropagation();var old=host.querySelector('.aro-chart-panel');if(old){old.remove();return;}document.querySelectorAll('.aro-chart-panel').forEach(function(x){x.remove();});host.appendChild(panel(chart,key,host));};
    chart.options.onClick=function(event,elements,instance){if(!elements||!elements.length)return;var el=elements[0],ds=instance.data.datasets[el.datasetIndex],raw=ds.data[el.index],x=raw&&typeof raw==='object'?raw.x:(instance.data.labels||[])[el.index],y=raw&&typeof raw==='object'?raw.y:raw,read=host.querySelector('.aro-chart-readout');if(!read){read=document.createElement('div');read.className='aro-chart-readout';host.appendChild(read);}read.textContent=(ds.label||'Series')+'  |  X: '+x+'  |  Y: '+y;};
  }
  function scan(){if(typeof Chart==='undefined'||!Chart.getChart)return;document.querySelectorAll('canvas[id]').forEach(function(c){var chart=Chart.getChart(c);if(chart)enhance(chart,c,c.id);});}
  window.AROCHARTCTRL={enhance:enhance,autoEnhance:scan};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(scan,150);});else setTimeout(scan,150);
})();
