/* Engineering conversion catalog. Each unit maps to its quantity's SI base:
   SI = value * factor + offset. Never mix different physical quantities.
   Definitions: BIPM SI Brochure; NIST SP 811 Appendix B.9. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AROUNITS = api;
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var inch = 0.0254, ft = 0.3048, lb = 0.45359237, g = 9.80665;
  var lbf = lb * g, gal = 0.003785411784, impgal = 0.00454609;
  var btu = 1055.05585262, cal = 4.184, psi = lbf / (inch * inch);
  var C = [];
  function add(id, name, group, base, units, note) {
    C.push({id:id, name:name, group:group, base:base, note:note || '',
      units:units.map(function(u){return {symbol:u[0], factor:u[1], offset:u[2] || 0};})});
  }
  var lengths = [['m',1],['mm',.001],['cm',.01],['µm',1e-6],['nm',1e-9],['km',1000],['in',inch],['ft',ft],['yd',3*ft],['mi',1609.344],['mil',inch/1000]];
  var pressures = [['Pa',1],['kPa',1000],['MPa',1e6],['GPa',1e9],['bar',1e5],['mbar',100],['psi',psi],['ksi',psi*1000],['atm',101325],['Torr',101325/760],['kgf/cm²',g*1e4],['dyn/cm²',.1],['mmH₂O (conventional)',g],['inH₂O (conventional)',g*25.4],['mmHg (conventional)',133.322387415]];
  add('length','Length / diameter / thickness','Geometry','m',lengths);
  add('roughness','Hydraulic roughness / surface finish','Geometry','m',lengths,'These use the same length units but describe different properties. Converting does not make surface finish interchangeable with hydraulic roughness.');
  add('area','Area','Geometry','m²',[['m²',1],['mm²',1e-6],['cm²',1e-4],['km²',1e6],['in²',inch*inch],['ft²',ft*ft],['yd²',9*ft*ft],['ha',1e4],['acre',4046.8564224]]);
  add('volume','Volume','Geometry','m³',[['m³',1],['L',.001],['mL',1e-6],['cm³',1e-6],['mm³',1e-9],['in³',inch**3],['ft³',ft**3],['US gal',gal],['Imperial gal',impgal],['US liquid qt',gal/4],['US liquid pint',gal/8],['US oil barrel (42 gal)',42*gal]]);
  add('angle','Plane angle','Geometry','rad',[['rad',1],['°',Math.PI/180],['arcmin',Math.PI/10800],['arcsec',Math.PI/648000],['turn',2*Math.PI],['gon',Math.PI/200]]);
  add('area-moment','Second moment of area','Geometry','m⁴',[['m⁴',1],['cm⁴',1e-8],['mm⁴',1e-12],['in⁴',inch**4],['ft⁴',ft**4]]);
  add('time','Time','Motion','s',[['s',1],['ms',.001],['µs',1e-6],['min',60],['h',3600],['day',86400],['week',604800],['year (365 days)',31536000]]);
  add('speed','Velocity / speed','Motion','m/s',[['m/s',1],['cm/s',.01],['mm/s',.001],['km/h',1/3.6],['ft/s',ft],['ft/min',ft/60],['in/s',inch],['mph',1609.344/3600],['kn',1852/3600]]);
  add('acceleration','Acceleration','Motion','m/s²',[['m/s²',1],['cm/s²',.01],['mm/s²',.001],['µm/s²',1e-6],['ft/s²',ft],['in/s²',inch],['Gal',.01],['g₀',g]],'Standard gravity g₀ = 9.80665 m/s².');
  add('frequency','Frequency','Motion','Hz',[['Hz',1],['kHz',1000],['MHz',1e6],['GHz',1e9],['cycles/min',1/60]]);
  add('rotation','Rotational speed','Motion','rad/s',[['rad/s',1],['rad/min',1/60],['rpm',2*Math.PI/60],['rev/s',2*Math.PI],['°/s',Math.PI/180]]);
  add('mass','Mass','Mechanical','kg',[['kg',1],['g',.001],['mg',1e-6],['µg',1e-9],['tonne',1000],['lb',lb],['oz',lb/16],['US short ton',2000*lb],['Imperial long ton',2240*lb],['slug',lbf/ft]]);
  add('force','Force / thrust','Mechanical','N',[['N',1],['kN',1000],['MN',1e6],['dyn',1e-5],['kgf',g],['gf',g*.001],['lbf',lbf],['ozf',lbf/16],['poundal',lb*ft]]);
  add('pressure','Pressure','Mechanical','Pa',pressures,'Preserve the pressure basis: gauge and absolute pressure are not interchangeable. p(abs) = p(gauge) + local atmospheric pressure. Water/mercury columns here are conventional definitions, not a fluid-head calculation.');
  add('stress','Stress / modulus / allowable stress','Mechanical','Pa',pressures.slice(0,12),'Unit conversion does not determine allowable stress; material grade, temperature and the applicable design code are still required.');
  add('torque','Torque / moment','Mechanical','N·m',[['N·m',1],['N·mm',.001],['kN·m',1000],['lbf·ft',lbf*ft],['lbf·in',lbf*inch],['kgf·m',g],['kgf·cm',g*.01],['dyn·cm',1e-7]]);
  add('energy','Energy / work / heat','Mechanical','J',[['J',1],['kJ',1000],['MJ',1e6],['GJ',1e9],['erg',1e-7],['Wh',3600],['kWh',3.6e6],['cal (thermochemical)',cal],['kcal (thermochemical)',1000*cal],['Btu (IT)',btu],['Btu (thermochemical)',1054.35026444],['ft·lbf',lbf*ft]],'IT and thermochemical Btu definitions are explicitly separated.');
  add('power','Power / heat duty','Mechanical','W',[['W',1],['kW',1000],['MW',1e6],['erg/s',1e-7],['hp (mechanical)',550*ft*lbf],['hp (metric)',75*g],['Btu (IT)/h',btu/3600],['Btu (IT)/s',btu],['kcal (thermochemical)/h',cal*1000/3600],['TR (12,000 Btu IT/h)',12000*btu/3600]]);
  add('mass-moment','Mass moment of inertia','Mechanical','kg·m²',[['kg·m²',1],['kg·cm²',1e-4],['g·cm²',1e-7],['lb·ft²',lb*ft*ft],['slug·ft²',lbf*ft]]);
  add('momentum','Momentum / impulse','Mechanical','N·s',[['N·s',1],['kN·s',1000],['kg·m/s',1],['lbf·s',lbf],['lb·ft/s',lb*ft]]);
  add('spring','Spring stiffness','Mechanical','N/m',[['N/m',1],['N/mm',1000],['kN/m',1000],['lbf/in',lbf/inch],['lbf/ft',lbf/ft]]);
  add('density','Density / mass concentration','Fluids','kg/m³',[['kg/m³',1],['g/cm³',1000],['g/mL',1000],['kg/L',1000],['g/L',1],['mg/L',.001],['lb/ft³',lb/(ft**3)],['lb/in³',lb/(inch**3)],['lb/US gal',lb/gal],['lb/Imperial gal',lb/impgal],['slug/ft³',(lbf/ft)/(ft**3)]]);
  add('specific-volume','Specific volume','Fluids','m³/kg',[['m³/kg',1],['L/kg',.001],['cm³/g',.001],['ft³/lb',(ft**3)/lb],['US gal/lb',gal/lb]]);
  add('vol-flow','Volumetric flow rate','Fluids','m³/s',[['m³/s',1],['m³/h',1/3600],['m³/min',1/60],['L/s',.001],['L/min',.001/60],['L/h',.001/3600],['mL/min',1e-6/60],['US gpm',gal/60],['Imperial gpm',impgal/60],['ft³/s',ft**3],['ft³/min (cfm)',ft**3/60],['US gal/day',gal/86400]],'Actual volumetric flow only. Standard/normal gas flow needs stated reference temperature, absolute pressure and compressibility; Nm³/h and SCFM cannot be converted to actual flow by a fixed factor.');
  add('mass-flow','Mass flow rate','Fluids','kg/s',[['kg/s',1],['kg/h',1/3600],['kg/min',1/60],['g/s',.001],['g/min',.001/60],['tonne/h',1000/3600],['lb/s',lb],['lb/min',lb/60],['lb/h',lb/3600]]);
  add('mass-flux','Mass flux','Fluids','kg/(m²·s)',[['kg/(m²·s)',1],['kg/(m²·h)',1/3600],['g/(cm²·s)',10],['lb/(ft²·s)',lb/(ft*ft)],['lb/(ft²·h)',lb/(ft*ft*3600)]]);
  add('head','Fluid head / NPSH','Fluids','m',lengths,'Head is a length. Pressure equivalent requires the fluid density and gravity: Δp = ρgH.');
  add('pressure-gradient','Pressure gradient','Fluids','Pa/m',[['Pa/m',1],['kPa/m',1000],['bar/m',1e5],['kPa/km',1],['psi/ft',psi/ft],['psi/100 ft',psi/(100*ft)]]);
  add('dynamic-viscosity','Dynamic viscosity','Fluids','Pa·s',[['Pa·s',1],['mPa·s',.001],['µPa·s',1e-6],['P',.1],['cP',.001],['kg/(m·s)',1],['lb/(ft·s)',lb/ft],['lb/(ft·h)',lb/(ft*3600)],['lbf·s/ft²',lbf/(ft*ft)]],'Dynamic viscosity and kinematic viscosity require density to convert between them: ν = μ/ρ.');
  add('kinematic-viscosity','Kinematic viscosity','Fluids','m²/s',[['m²/s',1],['mm²/s',1e-6],['St',1e-4],['cSt',1e-6],['ft²/s',ft*ft],['ft²/h',ft*ft/3600]]);
  add('surface-tension','Surface tension','Fluids','N/m',[['N/m',1],['mN/m',.001],['dyn/cm',.001],['lbf/ft',lbf/ft],['lbf/in',lbf/inch]]);
  add('diffusivity','Mass diffusivity / thermal diffusivity','Fluids','m²/s',[['m²/s',1],['cm²/s',1e-4],['mm²/s',1e-6],['ft²/s',ft*ft],['ft²/h',ft*ft/3600]]);
  add('permeability','Permeability','Fluids','m²',[['m²',1],['µm²',1e-12],['darcy',9.869233e-13],['millidarcy',9.869233e-16]],'Darcy factor follows NIST SP 811 rounded tabulation.');
  add('specific-weight','Specific weight','Fluids','N/m³',[['N/m³',1],['kN/m³',1000],['lbf/ft³',lbf/(ft**3)],['kgf/m³',g]]);
  add('temperature','Temperature (absolute scale)','Thermal','K',[['K',1],['°C',1,273.15],['°F',5/9,273.15-32*5/9],['°R',5/9]],'Absolute zero is 0 K = −273.15 °C = −459.67 °F. Use Temperature difference for ΔT and LMTD.');
  add('temperature-difference','Temperature difference / LMTD','Thermal','K',[['K',1],['Δ°C',1],['Δ°F',5/9],['Δ°R',5/9]],'Temperature differences use scale factors only, with no 273.15 or 32 offset.');
  add('specific-heat','Specific heat / specific entropy','Thermal','J/(kg·K)',[['J/(kg·K)',1],['kJ/(kg·K)',1000],['cal (th)/(g·K)',cal*1000],['kcal (th)/(kg·K)',cal*1000],['Btu (IT)/(lb·°F)',btu/lb*9/5]],'Entropy and heat capacity share dimensions but are different properties.');
  add('heat-capacity','Heat capacity / entropy','Thermal','J/K',[['J/K',1],['kJ/K',1000],['cal (th)/K',cal],['Btu (IT)/°F',btu*9/5]]);
  add('conductivity','Thermal conductivity','Thermal','W/(m·K)',[['W/(m·K)',1],['mW/(m·K)',.001],['W/(cm·K)',100],['Btu (IT)/(h·ft·°F)',btu/3600/ft*9/5],['Btu (IT)·in/(h·ft²·°F)',btu*inch/3600/(ft*ft)*9/5],['kcal (th)/(h·m·K)',cal*1000/3600]]);
  add('heat-transfer','Heat transfer coefficient','Thermal','W/(m²·K)',[['W/(m²·K)',1],['kW/(m²·K)',1000],['Btu (IT)/(h·ft²·°F)',btu/3600/(ft*ft)*9/5],['kcal (th)/(h·m²·K)',cal*1000/3600]]);
  add('heat-flux','Heat flux','Thermal','W/m²',[['W/m²',1],['kW/m²',1000],['W/cm²',1e4],['Btu (IT)/(h·ft²)',btu/3600/(ft*ft)],['kcal (th)/(h·m²)',cal*1000/3600]]);
  add('fouling','Fouling resistance / thermal insulance','Thermal','m²·K/W',[['m²·K/W',1],['m²·K/kW',.001],['h·ft²·°F/Btu (IT)',3600*ft*ft*5/9/btu],['h·m²·K/kcal (th)',3600/(cal*1000)]]);
  add('thermal-resistance','Thermal resistance','Thermal','K/W',[['K/W',1],['K/kW',.001],['°F·h/Btu (IT)',5/9*3600/btu]]);
  add('specific-energy','Specific enthalpy / specific energy','Thermal','J/kg',[['J/kg',1],['kJ/kg',1000],['MJ/kg',1e6],['cal (th)/g',cal*1000],['kcal (th)/kg',cal*1000],['Btu (IT)/lb',btu/lb]]);
  add('energy-density','Volumetric energy density','Thermal','J/m³',[['J/m³',1],['kJ/m³',1000],['MJ/m³',1e6],['Btu (IT)/ft³',btu/(ft**3)],['kWh/m³',3.6e6]]);
  add('expansion','Thermal expansion coefficient','Thermal','1/K',[['1/K',1],['1/°C',1],['1/°F',9/5],['µm/(m·K)',1e-6]]);
  add('amount','Amount of substance','Chemical','mol',[['mol',1],['mmol',.001],['µmol',1e-6],['kmol',1000],['lbmol',lb*1000]]);
  add('molar-flow','Molar flow rate','Chemical','mol/s',[['mol/s',1],['mol/min',1/60],['kmol/s',1000],['kmol/h',1000/3600],['lbmol/h',lb*1000/3600]]);
  add('molar-mass','Molar mass','Chemical','kg/mol',[['kg/mol',1],['g/mol',.001],['kg/kmol',.001],['lb/lbmol',.001]]);
  add('molar-concentration','Molar concentration','Chemical','mol/m³',[['mol/m³',1],['mol/L',1000],['mmol/L',1],['kmol/m³',1000],['lbmol/ft³',lb*1000/(ft**3)]]);
  add('molar-volume','Molar volume','Chemical','m³/mol',[['m³/mol',1],['L/mol',.001],['m³/kmol',.001],['ft³/lbmol',(ft**3)/(lb*1000)]]);
  add('molar-energy','Molar enthalpy / energy','Chemical','J/mol',[['J/mol',1],['kJ/mol',1000],['kJ/kmol',1],['cal (th)/mol',cal],['Btu (IT)/lbmol',btu/(lb*1000)]]);
  add('molar-heat','Molar heat capacity / entropy','Chemical','J/(mol·K)',[['J/(mol·K)',1],['kJ/(kmol·K)',1],['cal (th)/(mol·K)',cal],['Btu (IT)/(lbmol·°F)',btu/(lb*1000)*9/5]]);
  add('fraction','Fraction / percentage / ppm / ppb','Chemical','fraction',[['fraction',1],['%',.01],['ppm',1e-6],['ppb',1e-9]],'Keep the same basis (mass, mole or volume). ppm is not generally mg/L; that relationship needs density and a specified mass basis.');
  add('corrosion','Corrosion rate','Materials','m/s',[['m/s',1],['mm/year (365 days)',.001/31536000],['µm/year (365 days)',1e-6/31536000],['mil/year (mpy, 365 days)',inch/1000/31536000],['in/year (365 days)',inch/31536000]]);
  add('areal-mass','Areal mass / fabric GSM','Materials','kg/m²',[['kg/m²',1],['g/m² (GSM)',.001],['g/cm²',10],['oz/yd²',lb/16/(9*ft*ft)],['lb/ft²',lb/(ft*ft)]]);
  add('linear-mass','Mass per length','Materials','kg/m',[['kg/m',1],['g/m',.001],['kg/km',.001],['lb/ft',lb/ft],['lb/in',lb/inch]]);
  add('voltage','Electric potential','Electrical','V',[['V',1],['mV',.001],['µV',1e-6],['kV',1000]]);
  add('current','Electric current','Electrical','A',[['A',1],['mA',.001],['µA',1e-6],['kA',1000]]);
  add('resistance','Electric resistance','Electrical','Ω',[['Ω',1],['mΩ',.001],['kΩ',1000],['MΩ',1e6]]);
  add('conductance','Electric conductance','Electrical','S',[['S',1],['mS',.001],['µS',1e-6]]);
  add('capacitance','Capacitance','Electrical','F',[['F',1],['mF',.001],['µF',1e-6],['nF',1e-9],['pF',1e-12]]);
  add('inductance','Inductance','Electrical','H',[['H',1],['mH',.001],['µH',1e-6],['nH',1e-9]]);
  add('charge','Electric charge','Electrical','C',[['C',1],['mC',.001],['µC',1e-6],['Ah',3600],['mAh',3.6]]);
  add('magnetic-flux','Magnetic flux','Electrical','Wb',[['Wb',1],['mWb',.001],['Mx',1e-8]]);
  add('flux-density','Magnetic flux density','Electrical','T',[['T',1],['mT',.001],['µT',1e-6],['G',1e-4]]);
  function quantity(id) { return C.find(function(q){return q.id === id;}); }
  function unit(q, symbol) { var u = q.units.find(function(x){return x.symbol === symbol;}); if(!u) throw new Error('Unknown unit for '+q.name); return u; }
  function convert(id, value, from, to) {
    var q = quantity(id); if (!q) throw new Error('Unknown property');
    if(typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Enter a finite number');
    var a = unit(q,from), b = unit(q,to), si = value*a.factor+a.offset;
    if(!Number.isFinite(si)) throw new Error('Value is outside the supported numeric range');
    if(id === 'temperature' && si < -1e-10) throw new Error('Temperature is below absolute zero');
    var out = (si-b.offset)/b.factor;
    if(!Number.isFinite(out)) throw new Error('Result is outside the supported numeric range');
    return Object.is(out,-0) ? 0 : out;
  }
  return {catalog:C, quantity:quantity, convert:convert, references:[
    {name:'BIPM — SI Brochure, 9th edition',url:'https://www.bipm.org/en/publications/si-brochure'},
    {name:'NIST SP 811 — conversion factors by quantity',url:'https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9'}
  ]};
}));
