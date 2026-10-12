/* Always-available engineering unit converter; independent of design inputs. */
(function () {
  'use strict';
  var U = window.AROUNITS;
  if (!U) return;
  function init() {
    if (document.getElementById('aro-unit-dialog')) return;
    var opener = document.getElementById('aro-unit-open');
    var dialog = document.createElement('dialog');
    dialog.id = 'aro-unit-dialog'; dialog.setAttribute('aria-labelledby','auc-title');
    dialog.innerHTML = '<header class="auc-header"><div><p class="auc-eyebrow">AROGARA ENGINEERING TOOLS</p><h2 id="auc-title">Unit converter</h2><p>One property. Any supported unit. Available across every module.</p></div><button type="button" id="auc-close" aria-label="Close unit converter">×</button></header>'
      + '<div class="auc-body"><div class="auc-pick"><label for="auc-search">Find a property or unit<input id="auc-search" type="search" placeholder="Try viscosity, pressure, Btu, GSM…" autocomplete="off"></label><label for="auc-property">Engineering property<select id="auc-property"></select></label></div>'
      + '<p id="auc-count" class="auc-caption"></p><div class="auc-conversion"><div><label for="auc-from-value">From value</label><input id="auc-from-value" type="text" inputmode="decimal" value="1" autocomplete="off"><label for="auc-from-unit">From unit</label><select id="auc-from-unit"></select></div><button type="button" id="auc-swap" aria-label="Swap conversion direction" title="Swap units and values">⇄</button><div><label for="auc-to-value">To value <span class="auc-caption">(editable)</span></label><input id="auc-to-value" type="text" inputmode="decimal" autocomplete="off"><label for="auc-to-unit">To unit</label><select id="auc-to-unit"></select></div></div>'
      + '<div class="auc-result" role="status" aria-live="polite" id="auc-result"></div><p id="auc-note" class="auc-note"></p>'
      + '<div class="auc-actions"><label for="auc-precision">Significant digits<select id="auc-precision"><option>6</option><option selected>10</option><option>15</option></select></label><button type="button" id="auc-copy">Copy conversion</button><button type="button" id="auc-reset">Reset</button></div>'
      + '<details class="auc-details"><summary>Value in every unit for this property</summary><div class="auc-table-wrap"><table><thead><tr><th scope="col">Unit</th><th scope="col">Converted value</th><th scope="col">SI factor / offset</th></tr></thead><tbody id="auc-all"></tbody></table></div><p id="auc-formula" class="auc-caption"></p></details>'
      + '<details class="auc-details"><summary id="auc-catalog-summary">Properties &amp; supported units</summary><div class="auc-table-wrap auc-catalog"><table><thead><tr><th scope="col">Property / SI base</th><th scope="col">Supported units</th></tr></thead><tbody id="auc-catalog"></tbody></table></div></details>'
      + '<details class="auc-details"><summary>Unit standards &amp; definitions</summary><div class="auc-standards"><p>Conversions use SI as the common base, with metric, CGS and US / Imperial definitions drawn from the references below. Compound-unit factors are derived from those definitions. This catalog covers the listed quantities; it does not claim every unit or design standard.</p><ul id="auc-references"></ul><p><b>SI base units:</b> metre (m), kilogram (kg), second (s), ampere (A), kelvin (K), mole (mol), candela (cd).</p><p><b>Prefixes:</b> Q 10³⁰ · R 10²⁷ · Y 10²⁴ · Z 10²¹ · E 10¹⁸ · P 10¹⁵ · T 10¹² · G 10⁹ · M 10⁶ · k 10³ · h 10² · da 10¹ · d 10⁻¹ · c 10⁻² · m 10⁻³ · µ 10⁻⁶ · n 10⁻⁹ · p 10⁻¹² · f 10⁻¹⁵ · a 10⁻¹⁸ · z 10⁻²¹ · y 10⁻²⁴ · r 10⁻²⁷ · q 10⁻³⁰. Prefix symbols are case sensitive; only the explicitly listed unit choices are accepted.</p><p><b>Definitions:</b> 1 in = 0.0254 m; 1 ft = 0.3048 m; 1 lb = 0.45359237 kg; standard gravity = 9.80665 m/s². US liquid gallon = 3.785411784 L; Imperial gallon = 4.54609 L. Thermochemical calorie = 4.184 J; IT Btu ≈ 1055.05585262 J. Years here are fixed at 365 days.</p><p>Changing units changes a number’s representation, not a material’s physical properties. This tool does not overwrite project inputs or change the global display-unit setting. Copy a result into a field only after checking the field’s unit and basis.</p></div></details></div>';
    document.body.appendChild(dialog);
    var floating = document.createElement('button');
    floating.type = 'button'; floating.id = 'aro-unit-floating';
    floating.textContent = '⇄ Unit converter'; floating.title = 'Open unit converter (Alt+U)';
    floating.setAttribute('aria-haspopup','dialog'); floating.setAttribute('aria-controls',dialog.id);
    document.body.appendChild(floating);
    function el(id){return document.getElementById(id);}
    var property = el('auc-property'), fromUnit = el('auc-from-unit'), toUnit = el('auc-to-unit');
    var fromValue = el('auc-from-value'), toValue = el('auc-to-value'), search = el('auc-search');
    var q, valid = false, lastSide = 'from', previousFocus;
    var selection = Object.create(null);
    function fmt(n){return Number(n.toPrecision(Number(el('auc-precision').value))).toString();}
    function option(text,value){var o=document.createElement('option');o.textContent=text;o.value=value;return o;}
    function parse(text){
      var s=text.trim();
      if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) throw new Error('Enter a number, such as 12.5 or 1.2e3 (decimal point, no commas).');
      var v=Number(s); if(!Number.isFinite(v)) throw new Error('Enter a finite number.'); return v;
    }
    function unitChoices(select){select.replaceChildren();q.units.forEach(function(u){select.appendChild(option(u.symbol,u.symbol));});}
    function choose() {
      if(!property.value){q=null;valid=false;fromUnit.replaceChildren();toUnit.replaceChildren();toValue.value='';el('auc-all').replaceChildren();el('auc-result').textContent='No matching property. Try another search.';el('auc-note').textContent='';el('auc-formula').textContent='';el('auc-copy').disabled=true;return;}
      q=U.quantity(property.value); unitChoices(fromUnit);unitChoices(toUnit);
      var saved=selection[q.id];
      fromUnit.value=saved?saved.from:q.units[0].symbol;
      toUnit.value=saved?saved.to:q.units[Math.min(1,q.units.length-1)].symbol;
      el('auc-note').textContent=q.note || 'Conversion stays within this physical quantity. The SI base is '+q.base+'.';
      calculate('from');
    }
    function properties(){
      var term=search.value.toLowerCase().trim(), old=property.value;
      var matches=U.catalog.filter(function(p){return (p.name+' '+p.group+' '+p.base+' '+p.units.map(function(u){return u.symbol;}).join(' ')).toLowerCase().includes(term);});
      property.replaceChildren();
      var groups=Object.create(null);
      matches.forEach(function(p){if(!groups[p.group]){var group=document.createElement('optgroup');group.label=p.group;groups[p.group]=group;property.appendChild(group);}groups[p.group].appendChild(option(p.name,p.id));});
      if(matches.some(function(p){return p.id===old;}))property.value=old;
      el('auc-count').textContent=matches.length+' of '+U.catalog.length+' properties · '+U.catalog.reduce(function(n,p){return n+p.units.length;},0)+' unit choices · SI / metric / CGS / US / Imperial';
      choose();
    }
    function calculate(side){
      if(!q)return;
      lastSide=side; el('auc-result').classList.remove('auc-error');
      try{
        var raw=parse(side==='from'?fromValue.value:toValue.value);
        var converted=side==='from'?U.convert(q.id,raw,fromUnit.value,toUnit.value):U.convert(q.id,raw,toUnit.value,fromUnit.value);
        if(side==='from')toValue.value=fmt(converted);else fromValue.value=fmt(converted);
        var source=side==='from'?raw:converted;
        el('auc-result').textContent=fmt(source)+' '+fromUnit.value+' = '+fmt(side==='from'?converted:raw)+' '+toUnit.value;
        var body=el('auc-all');body.replaceChildren();
        q.units.forEach(function(u){var row=document.createElement('tr');[u.symbol,fmt(U.convert(q.id,source,fromUnit.value,u.symbol)),Number(u.factor.toPrecision(12)).toString()+(u.offset?' / '+Number(u.offset.toPrecision(12)).toString():'')].forEach(function(t){var cell=document.createElement('td');cell.textContent=t;row.appendChild(cell);});body.appendChild(row);});
        el('auc-formula').textContent='SI value = input × SI factor + offset; output = (SI value − output offset) ÷ output factor. SI base: '+q.base+'. Results are rounded for display; factors are retained at full stored precision.';
        selection[q.id]={from:fromUnit.value,to:toUnit.value};valid=true;
      }catch(e){valid=false;el('auc-result').textContent=e.message;el('auc-result').classList.add('auc-error');(side==='from'?toValue:fromValue).value='';el('auc-all').replaceChildren();el('auc-formula').textContent='';}
      el('auc-copy').disabled=!valid;
    }
    U.catalog.forEach(function(p){var row=document.createElement('tr'),a=document.createElement('td'),b=document.createElement('td');a.textContent=p.name+' ('+p.base+')';b.textContent=p.units.map(function(u){return u.symbol;}).join(' · ');row.append(a,b);el('auc-catalog').appendChild(row);});
    el('auc-catalog-summary').textContent='All '+U.catalog.length+' properties & supported units';
    U.references.forEach(function(r){var li=document.createElement('li'),a=document.createElement('a');a.textContent=r.name;a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';li.appendChild(a);el('auc-references').appendChild(li);});
    function open(){if(dialog.open)return;previousFocus=document.activeElement;dialog.showModal();search.focus();}
    function close(){dialog.close();}
    if(opener)opener.addEventListener('click',open);
    floating.addEventListener('click',open);el('auc-close').addEventListener('click',close);
    dialog.addEventListener('click',function(e){if(e.target===dialog){var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
    dialog.addEventListener('close',function(){if(previousFocus && previousFocus.isConnected)previousFocus.focus();});
    search.addEventListener('input',properties);property.addEventListener('change',choose);
    fromValue.addEventListener('input',function(){calculate('from');});toValue.addEventListener('input',function(){calculate('to');});
    fromUnit.addEventListener('change',function(){calculate('from');});toUnit.addEventListener('change',function(){calculate('from');});
    el('auc-precision').addEventListener('change',function(){calculate(lastSide);});
    el('auc-swap').addEventListener('click',function(){if(!q)return;var unit=fromUnit.value;fromUnit.value=toUnit.value;toUnit.value=unit;if(valid){var v=fromValue.value;fromValue.value=toValue.value;toValue.value=v;}calculate('from');});
    el('auc-reset').addEventListener('click',function(){search.value='';fromValue.value='1';properties();});
    el('auc-copy').addEventListener('click',function(){if(!valid)return;var text=q.name+': '+el('auc-result').textContent;if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(function(){el('auc-result').textContent='Copied: '+text;}).catch(function(){toValue.focus();toValue.select();el('auc-result').textContent='Copy unavailable. Result selected; press Ctrl+C or ⌘C.';});}else{toValue.focus();toValue.select();el('auc-result').textContent='Result selected; press Ctrl+C or ⌘C.';}});
    document.addEventListener('keydown',function(e){if(e.altKey&&e.key.toLowerCase()==='u'){e.preventDefault();open();}});
    /* Intersection alone cannot detect the landing/sign-in overlay covering
       the toolbar. Keep the utility available there as well. */
    function launcherVisibility(){
      if(!opener)return;
      var overlay=document.getElementById('aro-landing')||document.getElementById('aro-gate');
      var r=opener.getBoundingClientRect(),s=getComputedStyle(opener);
      var onScreen=r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth&&s.visibility!=='hidden';
      floating.hidden=onScreen&&!overlay;
    }
    if(opener&&'IntersectionObserver' in window)new IntersectionObserver(launcherVisibility).observe(opener);
    new MutationObserver(launcherVisibility).observe(document.body,{childList:true});
    launcherVisibility();
    properties();window.AROUNITCONVERTER={open:open,close:close};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
}());
