/* ══════════════════════════════════════════════════════════════════════
   AROGARA — LINE SIZING ENGINE  (window.AROLINE)

   One panel builder shared by the four single-stream line types, so LIQUID,
   GAS, STEAM and SLURRY all behave exactly as TWO-PHASE does: an AUTO mode
   where the engineer types the inputs, a MANUAL mode where the P&ID
   workbench takes the output panel and the drawing supplies line length,
   static height and fitting counts, undo / redo / reset, a live evaluation
   and a printable report with the 2D schematic and the 3D model.

   The hydraulics are common to all four and follow the client's workbooks:
     V    = Q·10⁶ / (3600 · 0.785 · D²)          D in mm, Q in m³/hr
     Re   = ρ·V·D / (0.001·μ)                    μ in cP, D in m
     f    = 64/Re (laminar) | 1.3255/[ln(ε/3.7D + 5.74/Re^0.9)]²
     ΔP   = f·L·ρ·V²/(2D) + ρ·g·Δz + ΔPequip + ½·ΣK·ρ·V²
     Ve   = C/√(ρ lb/ft³) ft/s → ×0.3048 → × design %
   What differs is how each stream gets ρ and μ, its velocity band and its
   own extra checks — the gas ideal-gas density, the steam table and its
   correlation, the slurry's Thomas viscosity and Durand deposition velocity.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────── shared libraries (all four workbooks) ─────────── */
  var PIPE = {
    0.5: { od: 0.840, s: { '5': 0.710, '10': 0.674, '40': 0.622, '80': 0.546, '160': 0.466 } },
    0.75: { od: 1.050, s: { '5': 0.920, '10': 0.884, '40': 0.824, '80': 0.742, '160': 0.614 } },
    1: { od: 1.315, s: { '5': 1.185, '10': 1.097, '40': 1.049, '80': 0.957, '160': 0.815 } },
    1.5: { od: 1.900, s: { '5': 1.770, '10': 1.682, '40': 1.610, '80': 1.500, '160': 1.338 } },
    2: { od: 2.375, s: { '5': 2.245, '10': 2.157, '40': 2.067, '80': 1.939, '160': 1.687 } },
    3: { od: 3.500, s: { '5': 3.334, '10': 3.260, '40': 3.068, '80': 2.900, '160': 2.624 } },
    4: { od: 4.500, s: { '5': 4.334, '10': 4.260, '40': 4.026, '80': 3.826, '160': 3.438 } },
    6: { od: 6.625, s: { '5': 6.407, '10': 6.357, '40': 6.065, '80': 5.761, '160': 5.187 } },
    8: { od: 8.625, s: { '5': 8.407, '10': 8.329, '40': 7.981, '80': 7.625, '160': 6.813 } },
    10: { od: 10.750, s: { '5': 10.482, '10': 10.420, '40': 10.020, '80': 9.750, '160': 8.500 } },
    12: { od: 12.750, s: { '5': 12.438, '10': 12.390, '40': 11.938, '80': 11.376, '160': 10.126 } },
    16: { od: 16.000, s: { '10': 15.500, '40': 15.000, '80': 14.312, '160': 12.812 } },
    20: { od: 20.000, s: { '10': 19.500, '40': 18.812, '80': 17.938, '160': 16.062 } },
    24: { od: 24.000, s: { '10': 23.500, '40': 22.624, '80': 21.562, '160': 19.312 } }
  };
  var SCHEDULES = ['5', '10', '40', '80', '160'];

  /* Absolute roughness (mm) and, for slurry, the pipe material erosion
     factor K used by Ve = K·√(ρm/1000). */
  var MAT = {
    'CS': [0.045, 2.2], 'MS': [0.045, 2.2], 'GI': [0.15, 2.0], 'SS304': [0.0015, 2.7],
    'SS304L': [0.0015, 2.7], 'SS316': [0.0015, 2.8], 'SS316L': [0.0015, 2.8],
    'SS321': [0.0015, 2.8], 'SS310': [0.0015, 3.0], 'Duplex SS': [0.0015, 3.2],
    'Cast iron': [0.26, 1.8], 'Asphalted cast iron': [0.12, 2.0], 'Wrought iron': [0.045, 2.0],
    'Concrete': [0.30, 1.5], 'Riveted steel': [0.90, 1.8],
    'Commercial steel / welded steel': [0.045, 2.2], 'Super Duplex SS': [0.0015, 3.5],
    'Alloy Steel': [0.045, 2.5], 'Copper': [0.0015, 2.0], 'Brass': [0.0015, 2.0],
    'PVC': [0.0015, 1.8], 'CPVC': [0.0015, 1.8], 'HDPE': [0.007, 1.7], 'FRP': [0.005, 1.8],
    'PTFE Lined': [0.001, 2.5], 'Rubber Lined': [0.01, 3.0], 'Hastelloy C276': [0.0015, 3.5],
    'Monel 400': [0.0015, 3.0], 'Inconel 600/625': [0.0015, 3.5], 'User defined': [null, null]
  };

  /* Fitting K banded by NPS — the workbook table, identical in all four. */
  var FIT_NAMES = ['Gate valve', 'Globe valve', 'Angle valve', 'Ball valve', 'Plug valve straightway',
    'Plug valve 3-way through', 'Plug valve branch flow', 'Swing check valve', 'Lift check valve',
    'Std elbow 90°', 'Std elbow 45°', 'Long radius 90°', 'Tee through flow', 'Tee through branch',
    'Mitre α=0°', 'Mitre α=30°', 'Mitre α=60°', 'Mitre α=90°'];
  var FIT_K = {
    0.5:  [0.22, 9.2, 1.48, 0.08, 0.49, 0.81, 2.43, 1.40, 16.2, 0.81, 0.43, 0.43, 0.54, 1.62, 0.05, 0.22, 0.68, 1.62],
    0.75: [0.20, 8.5, 1.38, 0.08, 0.45, 0.75, 2.25, 1.30, 15.0, 0.75, 0.40, 0.40, 0.50, 1.50, 0.05, 0.20, 0.63, 1.50],
    1:    [0.18, 7.8, 1.27, 0.07, 0.41, 0.69, 2.07, 1.20, 13.8, 0.69, 0.37, 0.37, 0.46, 1.38, 0.05, 0.18, 0.58, 1.38],
    1.5:  [0.15, 7.1, 1.16, 0.06, 0.38, 0.63, 1.89, 1.10, 12.6, 0.63, 0.34, 0.34, 0.42, 1.26, 0.04, 0.17, 0.53, 1.26],
    2:    [0.15, 6.5, 1.05, 0.06, 0.34, 0.57, 1.71, 1.00, 11.4, 0.57, 0.30, 0.30, 0.38, 1.14, 0.04, 0.15, 0.48, 1.14],
    3:    [0.14, 6.1, 0.99, 0.05, 0.32, 0.54, 1.62, 0.90, 10.8, 0.54, 0.29, 0.29, 0.36, 1.08, 0.04, 0.14, 0.45, 1.08],
    4:    [0.14, 5.8, 0.94, 0.05, 0.31, 0.51, 1.53, 0.90, 10.2, 0.51, 0.27, 0.27, 0.34, 1.02, 0.03, 0.14, 0.43, 1.02],
    6:    [0.12, 5.1, 0.83, 0.05, 0.27, 0.45, 1.35, 0.75, 9.00, 0.45, 0.24, 0.24, 0.30, 0.90, 0.03, 0.12, 0.38, 0.90],
    8:    [0.11, 4.8, 0.77, 0.04, 0.25, 0.42, 1.26, 0.70, 8.40, 0.42, 0.22, 0.22, 0.28, 0.84, 0.03, 0.11, 0.35, 0.84],
    12:   [0.10, 4.4, 0.72, 0.04, 0.23, 0.39, 1.17, 0.65, 7.80, 0.39, 0.21, 0.21, 0.26, 0.78, 0.03, 0.10, 0.33, 0.78],
    16:   [0.10, 4.1, 0.66, 0.04, 0.22, 0.36, 1.08, 0.60, 7.22, 0.36, 0.19, 0.19, 0.24, 0.72, 0.02, 0.10, 0.30, 0.72]
  };
  /* The fitting names and their resistance coefficients, shared so the
     component layer can put the same K on the same fitting it draws. Two
     lists would drift; there is one. */
  if (typeof window !== 'undefined') {
    window.AROFIT = { names: function () { return FIT_NAMES.slice(); },
                      table: function () { return FIT_K; },
                      band: function (nps) { return kBand(nps); } };
  }

  function kBand(nps) {
    var keys = Object.keys(FIT_K).map(Number).sort(function (a, b) { return a - b; });
    var pick = keys[0];
    for (var i = 0; i < keys.length; i++) if (nps >= keys[i]) pick = keys[i];
    return FIT_K[pick];
  }


  /* Saturated steam table from the workbook: p bar(a), T °C, v m³/kg, ρ kg/m³, h kJ/kg, μ ×10⁻⁶ Pa·s */
var STEAMTAB=[[0.01,6.98,129.2,0.008,2514,8.18],[1,99.62,1.694,0.59,2676,10.5],[2,120.23,0.886,1.129,2707,11.0],[3,133.55,0.606,1.65,2725,11.3],[4,143.63,0.463,2.162,2739,11.6],[5,151.86,0.375,2.667,2749,11.8],[6,158.85,0.316,3.165,2757,12.0],[7,164.97,0.273,3.664,2764,12.1],[8,170.43,0.24,4.167,2769,12.2],[9,175.38,0.215,4.651,2774,12.4],[10,179.91,0.194,5.144,2778,12.5],[11,184.08,0.177,5.65,2782,12.6],[12,187.96,0.163,6.135,2785,12.7],[13,191.6,0.151,6.623,2788,12.8],[14,195.04,0.141,7.092,2790,12.9],[15,198.32,0.132,7.576,2792,12.9],[16,201.44,0.124,8.065,2794,13.0],[17,204.44,0.117,8.547,2795,13.1],[18,207.3,0.111,9.009,2797,13.2],[19,209.92,0.105,9.524,2798,13.2],[20,212.42,0.0996,10.04,2800,13.3],[21,214.83,0.095,10.53,2800,13.3],[22,217.14,0.0907,11.03,2801,13.4],[23,219.37,0.0868,11.52,2801,13.4],[24,221.55,0.0832,12.02,2802,13.5],[25,223.99,0.08,12.5,2802,13.5],[26,225.67,0.0769,13,2803,13.6],[27,227.64,0.0741,13.5,2803,13.6],[28,229.57,0.0714,14,2803,13.7],[29,231.75,0.069,14.49,2804,13.7],[30,233.9,0.0667,15,2804,13.8],[31,235.9,0.0645,15.5,2804,13.8],[32,237.82,0.0625,16,2804,13.9],[33,239.46,0.0606,16.5,2804,13.9],[34,241.03,0.0588,17.01,2803,14.0],[35,242.56,0.057,17.54,2803,14.0],[36,244.05,0.0556,17.99,2803,14.0],[37,245.52,0.0541,18.48,2802,14.1],[38,246.95,0.0526,19.01,2802,14.1],[39,248.35,0.0513,19.49,2802,14.2],[40,250.4,0.0501,19.96,2801,14.2],[41,251.08,0.0488,20.49,2800,14.2],[42,252.43,0.0476,21.01,2800,14.3],[43,253.75,0.0465,21.51,2799,14.3],[44,255.05,0.0455,21.98,2799,14.3],[45,257.5,0.044,22.73,2798,14.4],[46,257.58,0.0435,22.99,2797,14.4],[47,258.86,0.0426,23.47,2796,14.5],[48,260.14,0.0417,23.98,2795,14.5],[49,262.08,0.0408,24.51,2795,14.5],[50,263.99,0.0395,25.32,2794,14.6],[51,265.3,0.0388,25.77,2793,14.6],[52,266.6,0.0381,26.25,2792,14.7],[53,267.8,0.0374,26.74,2791,14.7],[54,268.9,0.0367,27.25,2790,14.7],[55,270,0.036,27.78,2789,14.8],[56,271.2,0.0354,28.25,2788,14.8],[57,272.3,0.0348,28.74,2787,14.8],[58,273.4,0.0342,29.24,2786,14.9],[59,274.5,0.0336,29.76,2785,14.9],[60,275.6,0.033,30.3,2784,14.9],[61,276.7,0.0325,30.77,2783,15.0],[62,277.7,0.032,31.25,2782,15.0],[63,278.8,0.0315,31.75,2781,15.0],[64,279.9,0.031,32.26,2780,15.0],[65,280.9,0.0305,32.79,2778,15.1],[66,281.9,0.0301,33.22,2777,15.1],[67,282.9,0.0296,33.78,2776,15.1],[68,283.9,0.0292,34.25,2774,15.2],[69,284.9,0.0288,34.72,2773,15.2],[70,285.9,0.0284,35.21,2771,15.2],[71,286.8,0.028,35.71,2770,15.2],[72,287.8,0.0276,36.23,2768,15.3],[73,288.7,0.0272,36.76,2767,15.3],[74,289.7,0.0268,37.31,2766,15.3],[75,290.6,0.0264,37.88,2765,15.3],[76,291.5,0.0261,38.31,2763,15.4],[77,292.4,0.0257,38.91,2762,15.4],[78,293.3,0.0254,39.37,2760,15.4],[79,294.2,0.0251,39.84,2759,15.4],[80,295.1,0.0248,40.32,2758,15.5],[81,296,0.0245,40.82,2756,15.5],[82,296.8,0.0242,41.32,2755,15.5],[83,297.7,0.0239,41.84,2753,15.5],[84,298.5,0.0236,42.37,2752,15.6],[85,299.3,0.0234,42.74,2750,15.6],[86,300.2,0.0231,43.29,2748,15.6],[87,301,0.0228,43.86,2747,15.6],[88,301.8,0.0226,44.25,2745,15.7],[89,302.6,0.0223,44.84,2744,15.7],[90,303.4,0.0221,45.25,2742,15.7],[91,304.2,0.0219,45.66,2741,15.7],[92,304.9,0.0217,46.08,2739,15.8],[93,305.7,0.0215,46.51,2737,15.8],[94,306.5,0.0212,47.17,2736,15.8],[95,307.3,0.021,47.62,2734,15.8],[96,308,0.0208,48.08,2732,15.8],[97,308.8,0.0206,48.54,2730,15.9],[98,309.5,0.0204,49.02,2729,15.9],[99,310.3,0.0202,49.5,2727,15.9],[100,311.1,0.02,50,2725,15.9],[101,311.8,0.0198,50.51,2723,16.0],[102,312.5,0.0196,51.02,2721,16.0],[103,313.3,0.0194,51.55,2720,16.0],[104,314,0.0192,52.08,2718,16.0],[105,314.7,0.019,52.63,2716,16.1],[106,315.4,0.0188,53.19,2714,16.1],[107,316.1,0.0186,53.76,2713,16.1],[108,316.8,0.0184,54.35,2711,16.1],[109,317.5,0.0182,54.95,2709,16.1],[110,318.2,0.018,55.56,2707,16.2],[111,318.9,0.0178,56.18,2705,16.2],[112,319.5,0.0175,57.14,2703,16.2],[113,320.2,0.0173,57.8,2701,16.2],[114,320.9,0.0171,58.48,2699,16.2],[115,321.6,0.0168,59.52,2697,16.3],[116,322.2,0.0166,60.24,2695,16.3],[117,322.9,0.0163,61.35,2693,16.3],[118,323.5,0.0158,63.29,2689,16.3],[119,324.1,0.0153,65.36,2683,16.3],[120,324.8,0.0147,68.03,2677,16.4],[121,325.4,0.0145,68.97,2674,16.4],[122,326,0.0143,69.93,2671,16.4],[123,326.6,0.0141,70.92,2668,16.4],[124,327.3,0.0139,71.94,2665,16.4],[125,327.9,0.0138,72.46,2663,16.4],[126,328.5,0.0136,73.53,2660,16.5],[127,329.1,0.0134,74.63,2657,16.5],[128,329.7,0.0132,75.76,2654,16.5],[129,330.3,0.013,76.92,2651,16.5],[130,330.9,0.0128,78.13,2648,16.5],[131,331.5,0.0127,78.74,2645,16.5],[132,332.1,0.0125,80,2642,16.6],[133,332.7,0.0123,81.3,2639,16.6],[134,333.3,0.0122,81.97,2636,16.6],[135,333.9,0.012,83.33,2634,16.6],[136,334.4,0.0118,84.75,2630,16.6],[137,335,0.0117,85.47,2627,16.6],[138,335.6,0.0115,86.96,2625,16.6],[139,336.2,0.0114,87.72,2622,16.7],[140,336.8,0.0112,89.29,2620,16.7],[141,337.3,0.0111,90.09,2616,16.7],[142,337.9,0.0109,91.74,2613,16.7],[143,338.5,0.0108,92.59,2610,16.7],[144,339,0.0106,94.34,2607,16.7],[145,339.6,0.0105,95.24,2604,16.7],[146,340.1,0.0103,97.09,2601,16.8],[147,340.7,0.0102,98.04,2598,16.8],[148,341.2,0.0101,99.01,2595,16.8],[149,341.8,0.0099,101.01,2592,16.8],[150,342.3,0.0098,102.04,2589,16.8],[151,342.8,0.0097,103.09,2586,16.8],[152,343.3,0.0095,105.26,2582,16.8],[153,343.9,0.0094,106.38,2579,16.8],[154,344.4,0.0093,107.53,2575,16.9],[155,344.9,0.0092,108.7,2572,16.9],[156,345.4,0.009,111.11,2568,16.9],[157,345.9,0.0089,112.36,2565,16.9],[158,346.4,0.0088,113.64,2562,16.9],[159,346.9,0.0087,114.94,2558,16.9],[160,347.4,0.0087,114.94,2555,16.9],[161,347.9,0.0086,116.28,2551,16.9],[162,348.4,0.0085,117.65,2548,16.9],[163,348.9,0.0084,119.05,2544,16.9],[164,349.4,0.0083,120.48,2541,16.9],[165,349.9,0.0082,121.95,2537,16.9],[166,350.4,0.0081,123.46,2534,16.9],[167,350.9,0.008,125,2530,16.9],[168,351.4,0.0079,126.58,2526,16.9],[169,351.8,0.0078,128.21,2523,16.9],[170,352.3,0.0078,128.21,2519,16.9],[171,352.8,0.0077,129.87,2515,16.9],[172,353.3,0.0076,131.58,2511,16.9],[173,353.7,0.0075,133.33,2508,17.0],[174,354.2,0.0074,135.14,2504,17.0],[175,354.7,0.0073,136.99,2500,17.0],[176,355.2,0.0072,138.89,2496,17.0],[177,355.6,0.0071,140.85,2492,17.0],[178,356.1,0.0071,140.85,2488,17.0],[179,356.6,0.007,142.86,2484,17.0],[180,357.1,0.0069,144.93,2480,17.0],[181,357.5,0.0068,147.06,2476,17.0],[182,358,0.0068,147.06,2472,17.0],[183,358.4,0.0067,149.25,2468,17.0],[184,358.9,0.0066,151.52,2465,17.0],[185,359.4,0.0066,151.52,2462,17.0],[186,359.8,0.0065,153.85,2458,17.0],[187,360.3,0.0064,156.25,2454,17.0],[188,360.7,0.0064,156.25,2450,17.0],[189,361.2,0.0063,158.73,2447,17.0],[190,361.6,0.0063,158.73,2444,17.0],[191,362.1,0.0062,161.29,2440,17.0],[192,362.5,0.0062,161.29,2436,17.1],[193,363,0.0061,163.93,2433,17.1],[194,363.4,0.0061,163.93,2430,17.1],[195,363.8,0.006,166.67,2426,17.1],[196,364.3,0.006,166.67,2422,17.1],[197,364.7,0.0059,169.49,2419,17.1],[198,365.1,0.0059,169.49,2416,17.1],[199,365.5,0.0058,172.41,2413,17.1],[200,365.8,0.0058,172.41,2410,17.1],[201,366.2,0.0057,175.44,2402,17.1],[202,366.6,0.0056,178.57,2394,17.1],[203,367,0.0055,181.82,2385,17.1],[204,367.4,0.00545,183.49,2377,17.1],[205,367.8,0.0054,185.19,2368,17.2],[206,368.2,0.0053,188.68,2356,17.2],[207,368.6,0.0052,192.31,2345,17.2],[208,369,0.0051,196.08,2333,17.2],[209,369.4,0.005,200,2322,17.2],[210,369.9,0.0049,204.08,2310,17.2],[211,370.3,0.00476,210.08,2292,17.2],[212,370.7,0.00462,216.45,2274,17.2],[213,371.1,0.00448,223.21,2256,17.2],[214,371.5,0.00434,230.41,2238,17.2],[215,372,0.0042,238.1,2220,17.2],[216,372.4,0.00404,247.52,2198,17.2],[217,372.8,0.00388,257.73,2176,17.3],[218,373.2,0.00372,268.82,2154,17.3],[219,373.6,0.00356,280.9,2132,17.3],[220,373.95,0.0034,294.12,2110,17.3],[220.64,374.14,0.00317,315.46,2086,17.31]];
  /* ─────────── stream libraries ─────────── */
  var LIQUIDS = {
    'Water': [997, 1], 'Caustic Soda (50%)': [1525, 50], 'Dyes (typical solution)': [1050, 5],
    'Steam (saturated)': [0.6, 0.013], 'Wastewater': [1000, 1.2], 'Diesel': [850, 3],
    'LPG (liquid)': [550, 0.2], 'Hydrogen': [0.084, 0.009], 'Cooling water': [1000, 1],
    'Sulfur (molten)': [1800, 10], 'Ammonia (liquid)': [682, 0.25], 'Nitrogen': [1.17, 0.018],
    'Sulfuric acid (98%)': [1840, 24], 'Phosphoric acid (85%)': [1685, 40], 'Purified water': [998, 1],
    'Ethanol': [789, 1.2], 'Solvents (typical organic)': [850, 0.7], 'Milk': [1030, 2.5],
    'Boiler feed water': [995, 0.8], 'Air': [1.2, 0.018], 'User defined': [null, null]
  };
  /* service → [Vmin, Vmax, allowable ΔP bar/100 m] */
  var LIQ_SVC = {
    'Pump suction': [1, 1.5, 0.2], 'Drain pipe': [1.2, 2.1, 0.35], 'General': [2, 3, 0.45],
    'Gravity lines': [0.5, 1, 0.1], 'Boiler feed water': [2.5, 4.6, 0.45],
    'Pump discharge': [2.5, 3, 0.45], 'User defined': [null, null, null]
  };
  var LIQ_C = { 'Clean fluids': 100, 'Continuous service': 125, 'Intermittent service': 175,
                'Corrosion resistant alloys': 250, 'General (pure liquid)': 122,
                'Corrosive fluids': 100, 'User defined': null };

  /* Gas: molecular weight and viscosity (cP) */
  var GASES = {
    'Hydrogen (H₂)': [2.016, 0.0089], 'Helium (He)': [4.003, 0.0196], 'Methane (CH₄)': [16.043, 0.011],
    'Ethylene (C₂H₄)': [28.054, 0.0094], 'Nitrogen (N₂)': [28.013, 0.0176], 'Carbon monoxide (CO)': [28.01, 0.0174],
    'Air': [28.97, 0.0181], 'Oxygen (O₂)': [31.999, 0.0202], 'Hydrogen sulfide (H₂S)': [34.081, 0.0134],
    'Ammonia (NH₃)': [17.031, 0.0098], 'Carbon dioxide (CO₂)': [44.01, 0.0148], 'Nitrous oxide (N₂O)': [44.013, 0.0147],
    'Propane (C₃H₈)': [44.097, 0.0083], 'Sulfur dioxide (SO₂)': [64.066, 0.0125], 'Butane (C₄H₁₀)': [58.124, 0.0078],
    'Chlorine (Cl₂)': [70.906, 0.013], 'Pentane (C₅H₁₂)': [72.151, 0.007], 'Hexane (C₆H₁₄)': [86.178, 0.0068],
    'Ethane (C₂H₆)': [30.07, 0.0092], 'i-Butane (i-C₄H₁₀)': [58.12, 0.0079], 'n-Butane (n-C₄H₁₀)': [58.12, 0.0078],
    'i-Pentane (i-C₅H₁₂)': [72.15, 0.0071], 'n-Pentane (n-C₅H₁₂)': [72.15, 0.007], 'User defined': [null, null]
  };
  var GAS_SVC = {
    'Instrument air': [10, 15], 'Plant air': [15, 20], 'Nitrogen': [15, 25], 'Oxygen': [10, 20],
    'Hydrogen': [20, 40], 'Natural gas': [15, 30], 'Fuel gas': [15, 25], 'Flare gas header': [20, 60],
    'Vent gas': [15, 40], 'CO₂ gas': [10, 25], 'Ammonia vapour': [10, 20], 'Chlorine gas': [5, 15],
    'Hydrogen sulfide (H₂S)': [10, 20], 'Compressor suction gas': [10, 20],
    'Compressor discharge gas': [15, 30], 'Vacuum gas lines': [10, 15], 'User defined': [null, null]
  };
  var GAS_C = { 'Clean gas': 175, 'Dry natural gas': 200, 'Non-corrosive gas': 175,
                'Corrosive gas': 112, 'Gas with solids': 75, 'Offshore production': 100, 'User defined': null };

  /* Steam service bands, saturated and superheated */
  var STEAM_SVC = {
    'Branch lines': [15, 25, 20, 30], 'Process lines': [20, 35, 25, 40],
    'Distribution mains': [25, 40, 30, 45], 'High-pressure mains': [30, 50, 35, 55],
    'Main header': [30, 45, 35, 50], 'Turbine inlet lines': [null, null, 40, 60],
    'User defined': [null, null, null, null]
  };
  var STEAM_C = { 'Clean dry steam': 200, 'Wet steam': 125, 'Corrosive / wet service': 100, 'User defined': null };

  /* Slurry solids and carriers: [density kg/m³, viscosity cP] */
  var SOLIDS = {
    'Coal': [1400, 1], 'Fly ash': [2100, 1], 'Bottom ash': [2500, 1], 'Limestone': [2650, 1],
    'Lime (CaO)': [3350, 1], 'Hydrated lime': [2300, 1], 'Sand (silica)': [2625, 1], 'Clay': [2550, 2],
    'Cement': [3075, 1], 'Iron ore': [4850, 1], 'Hematite': [5150, 1], 'Magnetite': [5150, 1],
    'Copper concentrate': [4000, 1], 'Bauxite': [2500, 1], 'Phosphate rock': [3000, 1],
    'Gypsum': [2300, 1], 'Kaolin': [2575, 2], 'Alumina': [3950, 1], 'Titanium ore': [4500, 1],
    'Lead concentrate': [7000, 1], 'Zinc concentrate': [4250, 1], 'Nickel ore': [3150, 1],
    'Gold tailings': [2800, 1], 'Red mud': [3050, 5], 'Sludge (WWTP)': [1175, 5], 'User defined': [null, null]
  };
  var CARRIERS = {
    'Water': [998, 1], 'Sea water': [1025, 1.1], 'Brine (10% NaCl)': [1070, 1.2],
    'Saturated brine': [1200, 1.8], 'Cooling water': [998, 1], 'Wastewater': [1025, 1.2],
    'Caustic soda 10%': [1110, 1.5], 'Caustic soda 20%': [1220, 2], 'Caustic soda 30%': [1330, 4],
    'Sulfuric acid 10%': [1070, 1.2], 'Sulfuric acid 20%': [1140, 1.5], 'Sulfuric acid 50%': [1400, 6],
    'Hydrochloric acid 10%': [1048, 1.3], 'Hydrochloric acid 20%': [1098, 1.5], 'Nitric acid 30%': [1180, 1.2],
    'Ethylene glycol': [1110, 20], 'Propylene glycol': [1035, 58], 'Methanol': [792, 0.6],
    'Ethanol': [789, 1.2], 'Kerosene': [800, 1.8], 'Diesel': [840, 3.5], 'Fuel oil': [915, 100],
    'Crude oil (light)': [825, 10], 'Crude oil (heavy)': [940, 200], 'User defined': [null, null]
  };
  var SLU_SVC = {
    'Water + fine clay': [1, 1.5], 'Limestone slurry': [1.5, 2.5], 'Lime slurry': [1.5, 2.5],
    'Gypsum slurry': [1.5, 2.5], 'Fly ash slurry': [2, 3], 'Coal slurry': [2, 4],
    'Phosphate slurry': [2, 4], 'Tailings slurry': [2.5, 4], 'Sand slurry': [3, 5],
    'Copper concentrate': [3, 5], 'Iron ore slurry': [3, 5], 'Magnetite slurry': [3.5, 6],
    'User defined': [null, null]
  };

  /* ─────────── shared helpers ─────────── */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* ── unit-aware display ──────────────────────────────────────────────
     Results used to be written with the unit spelled into the string, so a
     line sized in US customary still reported "3.38 m/s" and "102.26 mm".
     U() converts an SI figure into whatever system the suite is set to and
     appends that system's symbol. UB() does the same for a band, printing
     the symbol once. Both fall back to SI when the table is unavailable. */
  function U(si, type, dp) {
    if (!isFinite(si)) return '—';
    if (typeof window.fromSIDisplay === 'function') return window.fromSIDisplay(type, si, dp == null ? 2 : dp);
    return si.toFixed(dp == null ? 2 : dp);
  }
  function CV(si, type) {
    var C = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS[type];
    return C ? C.fromSI(si, window.activeUnitSystem || 'SI') : si;
  }
  function SYM(type) {
    var C = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS[type];
    return C ? C.symbol(window.activeUnitSystem || 'SI') : '';
  }
  function UB(lo, hi, type, dp) {
    if (!isFinite(lo) || !isFinite(hi)) return '—';
    var d = dp == null ? 2 : dp;
    return CV(lo, type).toFixed(d) + ' – ' + CV(hi, type).toFixed(d) + ' ' + SYM(type);
  }
  /* The "(G)"/"(a)" gauge/absolute basis marker is an Excel-sheet convention
     that only ever qualifies "bar" — psi and kg/cm² never carry it. U() on
     its own doesn't know which caller wants a basis suffix, so this wraps it
     and only appends the suffix when the resolved symbol is actually "bar". */
  function UG(si, type, dp, suffix) {
    var v = U(si, type, dp);
    return v === '—' ? v : v + (SYM(type) === 'bar' ? suffix : '');
  }

  /* Printed unit → the quantity it measures. Anything absent is the same in
     every system this suite offers (per cent, centipoise, kg/kmol) or is a
     property the suite does not convert (kg/m³ is the density type, which is
     handled by tagging density fields directly where they are declared). */
  var UNIT_OF = {
    'm': 'length-m', 'mm': 'length-mm', 'm/s': 'velocity',
    'm³/hr': 'vol-flow', 'kg/hr': 'mass-flow',
    'bar': 'press-drop', 'bar(G)': 'pressure', 'bar(a)': 'pressure',
    '°C': 'temperature', 'kg/m³': 'density'
  };

  /* The symbol for a quantity in whatever system is active right now. */
  function symbolNow(type) {
    var C = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS[type];
    return C ? C.symbol(window.activeUnitSystem || 'SI') : '';
  }

  function f1(v) { return isFinite(v) ? v.toFixed(1) : '—'; }
  function f2(v) { return isFinite(v) ? v.toFixed(2) : '—'; }
  function f3(v) { return isFinite(v) ? v.toFixed(3) : '—'; }
  function f4(v) { return isFinite(v) ? v.toFixed(4) : '—'; }
  function f0(v) { return isFinite(v) ? Math.round(v).toLocaleString() : '—'; }

  /* A quantity above zero is a decision, so the box says so: the field turns
     green, its label brightens, and a chip row above the grid lists what has
     been selected with its count. Reading the schedule stops being a scan of
     eighteen zeros. */
  function highlightFittings(prefix, names, chipHostId) {
    var chosen = [];
    names.forEach(function (n, i) {
      var e = document.getElementById(prefix + 'fit-' + i);
      if (!e) return;
      var q = parseFloat(e.value);
      var on = isFinite(q) && q > 0;
      var lab = e.closest ? e.closest('label') : null;
      if (on) {
        e.style.background = 'rgba(34,197,94,0.12)';
        e.style.borderColor = '#22c55e';
        e.style.color = '#86efac';
        e.style.fontWeight = '800';
        if (lab) lab.style.color = '#22c55e';
        chosen.push({ name: n, qty: q });
      } else if (!e.readOnly) {
        e.style.background = 'rgba(2,6,18,0.6)';
        e.style.borderColor = 'var(--border-muted)';
        e.style.color = '#e2e8f0';
        e.style.fontWeight = '';
        if (lab) lab.style.color = 'var(--text-muted)';
      } else {
        e.style.background = 'rgba(56,189,248,0.08)';
        e.style.borderColor = '#38bdf8';
        e.style.color = '#7dd3fc';
        e.style.fontWeight = '';
        if (lab) lab.style.color = 'var(--text-muted)';
      }
    });
    var box = document.getElementById(chipHostId);
    if (box) {
      var total = chosen.reduce(function (a, c) { return a + c.qty; }, 0);
      if (!chosen.length) { box.style.display = 'none'; box.innerHTML = ''; }
      else {
        box.style.display = 'block';
        box.innerHTML = '<div style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;margin-bottom:4px;">'
          + total + ' item' + (total > 1 ? 's' : '') + ' selected across ' + chosen.length + ' type' + (chosen.length > 1 ? 's' : '') + '</div>'
          + '<div style="display:flex;flex-wrap:wrap;gap:4px;">'
          + chosen.map(function (c) {
              return '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(34,197,94,0.12);border:1px solid #22c55e;color:#86efac;'
                + 'font-family:var(--font-mono);font-size:9px;font-weight:700;padding:3px 7px;border-radius:10px;">'
                + String(c.name).replace(/[&<>"]/g, '') + '<b style="background:#22c55e;color:#052e16;border-radius:8px;padding:0 5px;">' + c.qty + '</b></span>';
            }).join('')
          + '</div>';
      }
    }
    return chosen;
  }
  window.AROFITHL = highlightFittings;

  function bore(nps, sch) {
    var pd = PIPE[nps] || PIPE[2];
    var idIn = pd.s[sch] !== undefined ? pd.s[sch] : pd.s['40'];
    return { idIn: idIn, odIn: pd.od, thkIn: pd.od - idIn, Dmm: idIn * 25.4, D: idIn * 25.4 / 1000 };
  }
  /* Colebrook as the workbooks write it, laminar below Re 2100. */
  function friction(Re, eps, Dmm) {
    if (!isFinite(Re) || Re <= 0) return NaN;
    return Re < 2100 ? 64 / Re : 1.3255 / Math.pow(Math.log((eps / (3.7 * Dmm)) + (5.74 / Math.pow(Re, 0.9))), 2);
  }
  function behaviour(Re) { return Re < 2100 ? 'LAMINAR' : Re <= 4000 ? 'TRANSITION' : 'TURBULENT'; }

  /* ─────────── the panel builder ─────────── */
  function make(cfg) {
    var P = cfg.key;                                   // id prefix, e.g. 'liq'
    var built = false, LAST = null, MODE = 'auto', PIDSUM = null;
    var UNDO = [], REDO = [], lastSnap = null, DEFAULTS = null;
    var id = function (n) { return P + '-' + n; };

    /* ── READING THE FORM ──────────────────────────────────────────────────
       Every input in the module is read through g() and t(), and every
       calculation — the real one and every trial the size search runs — used
       to go to the DOM for each field.

       That was affordable while a recalculation meant one compute(). It is
       not affordable now. A failing duty sends calc() into the design ladder,
       which sweeps the whole ASME B36.10M range four times over; each trial
       WROTE its candidate bore into the live <select>, called compute(), and
       wrote the original back. Around 350 compute() calls per keystroke, each
       doing thirty getElementById lookups and a unit conversion, and 1400
       writes into form controls sitting inside a large CSS grid — every one
       of them able to invalidate layout.

       Measured on the reported case (sulfuric acid, 100 m³/hr, a drawn P&ID,
       no bore that passes): a single keystroke in the flow field blocked the
       main thread for 2.3 seconds. Three keystrokes and the browser puts up
       "Page Unresponsive". That is the bug.

       Two changes, neither of which touches a formula:

       TRIAL   a trial no longer writes to the form. The candidate values sit
               in an override map that g() and t() consult first, so compute()
               reads exactly what it would have read had the value been typed
               — including the same display-unit-to-SI conversion siOf does —
               while the form itself is never touched.

       PASS    within one recalculation the form cannot change, so each field
               is read from the DOM once and reused. Trials vary three or four
               names; the other thirty are read once for the whole sweep.

       The cache is off by default and is only opened for the duration of a
       pass, so a stale read is not possible between them. Anything that
       writes to the form mid-pass calls passDrop() to re-read.             */
    var TRIAL = null;                    // trial overrides, or null when reading the form
    var PASS = null;                     // per-pass value cache, or null when off
    var UTYPE = {};                      // a field's unit tag, fixed once built

    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function passOpen() { PASS = { g: {}, t: {} }; }
    function passShut() { PASS = null; }
    function passDrop() { if (PASS) PASS = { g: {}, t: {} }; }

    /* null means there is no such field — g() returned its default for that
       before and still must, so a missing field is not confused with a blank. */
    function unitType(n) {
      if (!has(UTYPE, n)) { var e = $(id(n)); UTYPE[n] = e ? (e.getAttribute('data-unit-type') || '') : null; }
      return UTYPE[n];
    }
    /* parseFloat plus the conversion siOf() applies, without needing the
       element — a trial value means what it would have meant typed in. */
    function siFrom(n, raw) {
      var v = parseFloat(raw);
      if (!isFinite(v)) return NaN;
      var ty = unitType(n);
      if (ty && window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS[ty]) {
        var s = window.UNIT_CONVERSIONS[ty].toSI(v, window.activeUnitSystem || 'SI');
        return isFinite(s) ? s : NaN;
      }
      return v;
    }
    function readG(n) {
      var e = $(id(n)); if (!e) return undefined;
      if (typeof window.siOf === 'function' && e.getAttribute('data-unit-type')) {
        var s = window.siOf(id(n), NaN);
        return isFinite(s) ? s : NaN;
      }
      var v = parseFloat(e.value); return isFinite(v) ? v : NaN;
    }
    /* Every numeric input in the module comes back through here, so tagging a
       field is enough to make it convert — siOf returns SI whatever system the
       box is displaying, and leaves an untagged field untouched. */
    var g = function (n, d) {
      if (TRIAL && has(TRIAL, n)) {
        if (unitType(n) === null) return d;            // no such field
        var s = siFrom(n, TRIAL[n]);
        return isFinite(s) ? s : d;
      }
      var v;
      if (PASS) { if (!has(PASS.g, n)) PASS.g[n] = readG(n); v = PASS.g[n]; }
      else v = readG(n);
      return (v === undefined || !isFinite(v)) ? d : v;
    };
    var t = function (n, d) {
      if (TRIAL && has(TRIAL, n)) { var s = String(TRIAL[n]); return s || d; }
      var v;
      if (PASS) { if (!has(PASS.t, n)) { var e = $(id(n)); PASS.t[n] = e ? e.value : undefined; } v = PASS.t[n]; }
      else { var e2 = $(id(n)); v = e2 ? e2.value : undefined; }
      return v === undefined ? d : (v || d);
    };

    /* ── field helpers ── */
    /* Line-sizing inputs were plain number boxes with the unit painted on as
       static text, so the whole module ignored the suite's unit selector —
       inputs and outputs alike stayed in SI whatever the engineer chose.

       UNIT_OF maps a printed unit to the quantity it measures. A field whose
       unit is in that map is tagged, which does three things: the global
       unit-swap handler converts its value, updateUnitLabels() rewrites its
       symbol, and g() below reads it back in SI. Units not in the map are
       already system-independent (%, cP, kg/kmol, kg/m³ in this suite) and
       are left exactly as they were. */
    function fld(label, n, unit, v, step) {
      var type = UNIT_OF[unit] || '';
      var shown = v;
      if (type && v !== '' && isFinite(parseFloat(v)) && window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS[type]) {
        var conv = window.UNIT_CONVERSIONS[type].fromSI(parseFloat(v), window.activeUnitSystem || 'SI');
        shown = Number(conv.toFixed(6)).toString();
      }
      /* Gauge and absolute markers ride with the symbol in one span. Written
         as a separate span they sat a word away from their unit — "KG/CM²
         (G)" — and the fixed-width chip widened the gap further. */
      var suffix = (unit === 'bar(G)') ? '(G)' : (unit === 'bar(a)') ? '(a)' : '';
      return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
        + '<span style="display:flex;align-items:center;gap:4px;margin-top:2px;">'
        + '<input id="' + id(n) + '" type="number"' + (type ? ' data-unit-type="' + type + '"' : '')
        + ' step="' + (step || 'any') + '" value="' + shown + '" '
        + 'style="flex:1;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;"/>'
        + (unit ? '<span class="unit"' + (type ? ' data-unit-type="' + type + '"' : '')
                + (suffix ? ' data-unit-suffix="' + suffix + '"' : '')
                + ' style="font-size:9px;color:#64748b;white-space:nowrap;">'
                + (type ? symbolNow(type) + (symbolNow(type) === 'bar' ? suffix : '') : unit) + '</span>' : '')
        + '</span></label>';
    }
    function txtf(label, n, v) {
      return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
        + '<input id="' + id(n) + '" type="text" value="' + esc(v || '') + '" style="width:100%;margin-top:2px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;box-sizing:border-box;"/></label>';
    }
    function sel(label, n, opts, cur) {
      return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
        + '<select id="' + id(n) + '" style="width:100%;margin-top:2px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;">'
        + opts.map(function (o) { return '<option' + (String(o) === String(cur) ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>';
    }
    /* Section 1 uses the suite's design-data-sheet card — the same accordion,
       three-column grid and cell styling as pump sizing, so a line data sheet
       and a pump data sheet read as one document set. */
    function cell(label, n, type, ph, v) {
      return '<div class="input-cell pump-cell"><label for="' + id(n) + '">' + label + '</label>'
        + '<input type="' + (type || 'text') + '" id="' + id(n) + '" class="form-control text-data pump-input"'
        + (v ? ' value="' + esc(v) + '"' : '') + (ph ? ' placeholder="' + esc(ph) + '"' : '')
        + (type === 'date' ? ' style="color-scheme:dark;"' : '') + '/></div>';
    }
    function dataSheet() {
      return '<details class="pump-accordion" open><summary>01 &middot; DESIGN DATA SHEET <span class="chevron">&#9660;</span></summary>'
        + '<div class="acc-content input-grid-3" style=\"grid-template-columns:repeat(auto-fit,minmax(150px,1fr));align-items:start;\">'
        + cell('Company Name', 'company', 'text', 'Company Name')
        + cell('Project Location', 'loc', 'text', 'Project Location')
        + cell('Line Tag No', 'lineno', 'text', cfg.tagPh || 'L-101-A')
        + cell('Service Description', 'svcdesc', 'text', 'Service Description')
        + cell('P&ID No.', 'pid', 'text', 'PID-001')
        + cell('Line From', 'from', 'text', 'From')
        + cell('Line To', 'to', 'text', 'To')
        + cell('Engineer', 'engineer', 'text', 'Engineer')
        + cell('Date', 'dsdate', 'date', '')
        + cell('Revision', 'dsrev', 'text', '0', '0')
        + '</div></details>';
    }
    function hdr(x) { return '<div style="font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.06em;margin:14px 0 4px;border-bottom:1px solid var(--border-muted);padding-bottom:3px;">' + x + '</div>'; }
    function two(a, b) { return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div>' + a + '</div><div>' + b + '</div></div>'; }
    var H = { fld: fld, txtf: txtf, sel: sel, hdr: hdr, two: two, id: id };

    /* Section 00, one accordion above the data sheet — same document classes
       and depth as the pump user manual, so the two read as one manual set.
       Steps 2/3/5 are supplied per stream (cfg.manualProps/Service/Erosion);
       everything either side of them — data sheet, pipe data, fittings,
       AUTO/MANUAL design mode, run, reading results, auto-design, report —
       is identical across Liquid, Gas, Steam and Slurry, so it is written
       once here instead of four times. */
    function manualHTML() {
      var h = '<details class="pump-accordion" id="' + id('manual') + '">'
        + '<summary>00 &middot; USER MANUAL &mdash; HOW TO SIZE ' + esc(cfg.manualNoun || cfg.title) + ' <span class="chevron">&#9660;</span></summary>'
        + '<div class="acc-content" style="display:block;"><div class="aro-doc">';

      h += '<p class="aro-doc-lead">' + cfg.manualLead + ' Work down the sections in order &mdash; the panel '
        + 'validates each input as you enter it and reports the engineering results when you press RUN, and you can correct a section without losing '
        + 'anything already entered.</p>';

      h += '<div class="aro-doc-callout aro-doc-callout--warn"><b>Starting a new line? Press RESET first.</b> '
        + 'The panel keeps the previous line\'s inputs &mdash; fluid, service, geometry, fittings and results &mdash; sitting '
        + 'in every field until you clear them. RESET returns every field, the 3D view and the report to their untouched '
        + 'starting state before you enter a single value.</div>';

      h += '<div class="aro-doc-callout aro-doc-callout--info"><b>Set your units first.</b> The <b>unit system selector</b> '
        + 'in the top bar drives this line and the whole suite together &mdash; SI (m, bar, kg/hr), US customary '
        + '(ft, psi, GPM) or mixed metric (cm, kg/cm&sup2;, L/min). You may switch at any time, including after a run: '
        + 'every input, output, chart, 3D model and report converts together. Switching units never changes the answer, '
        + 'only how it is written &mdash; the calculation itself always runs in SI underneath.</div>';

      h += '<h4 class="aro-doc-h">Step 1 &mdash; 01 &middot; Design data sheet</h4>'
        + '<p>Company, project location, line tag number, service description, P&amp;ID number, from/to, engineer, date '
        + 'and revision. None of it affects the calculation; all of it is printed on the report, so fill it in if the '
        + 'output is going into a document package.</p>';

      h += '<h4 class="aro-doc-h">Step 2 &mdash; 02 &middot; Physical properties</h4>' + cfg.manualProps;
      h += '<h4 class="aro-doc-h">Step 3 &mdash; 03 &middot; Operating conditions &amp; service</h4>' + cfg.manualService;

      h += '<h4 class="aro-doc-h">Step 4 &mdash; 04 &middot; Pipe data</h4>'
        + '<ol class="aro-doc-ol">'
        + '<li><b>NPS</b> and <b>Schedule</b> &mdash; the bore under evaluation, from the ASME B36.10M table.</li>'
        + '<li><b>Pipe Material</b> &mdash; sets the Colebrook absolute roughness ε used in the friction factor'
        + (cfg.usesKmat ? ', and the erosion factor K used in section 5' : '') + '. Choosing <i>User defined</i> opens a '
        + 'field to enter ε (' + (cfg.usesKmat ? 'and K ' : '') + ') yourself.</li>'
        + '<li><b>AUTO-DESIGN MODE</b> &mdash; tick it and every recalculation adopts the smallest bore and schedule that '
        + 'satisfies every check together, the moment a check fails. Off, the same size is offered inline with an APPLY '
        + 'button instead of being applied automatically.</li>'
        + '<li><b>Line length</b>, <b>static height &Delta;z</b> and <b>equipment/vendor &Delta;P</b> &mdash; the geometry '
        + 'and any fixed loss (a control valve, an orifice plate) not covered by the fittings list below.</li>'
        + '</ol>';

      h += '<h4 class="aro-doc-h">Step 5 &mdash; 05 &middot; ' + esc(cfg.eroTitle || 'Erosional velocity (API RP 14E)') + '</h4>' + cfg.manualErosion;

      h += '<h4 class="aro-doc-h">Step 6 &mdash; 06 &middot; Fittings &amp; valves</h4>'
        + '<p>Enter a quantity against each fitting or valve actually on the run. Each one carries a resistance '
        + 'coefficient K banded by NPS (Crane TP-410); anything left at zero contributes nothing. A chip row above the '
        + 'list summarises whatever has a quantity, so the schedule reads at a glance instead of as eighteen zeros.</p>';

      h += '<h4 class="aro-doc-h">AUTO vs MANUAL &mdash; the P&amp;ID workbench</h4>'
        + '<p>The <b>DESIGN MODE</b> selector switches between two ways of describing the run:</p>'
        + '<ul class="aro-doc-ul">'
        + '<li><b>AUTO</b> &mdash; length, elevation and fittings are the numbers you typed in sections 4 and 6. This is '
        + 'the fast path for a single straight run or an early estimate.</li>'
        + '<li><b>MANUAL</b> &mdash; opens a P&amp;ID workbench: draw the actual route leg by leg, drop valves, bends, '
        + 'flanges and reducers from the component library onto it, and the developed length, static height and every '
        + 'fitting count are read back from the drawing instead of typed in. Corner elbows are assumed automatically '
        + 'unless you place one yourself. A reducer dropped on the line resizes every leg on its downstream side.</li>'
        + '</ul>'
        + '<p>Both modes share one 3D view of the line: real bore per NPS, actual flanges with bolts and gaskets, and '
        + 'a dense stream of glowing particles running through the pipe in the direction of flow, at a speed keyed to '
        + 'the calculated velocity &mdash; so the line reads as fluid actually moving in service, not a static rod. A '
        + '<b>COLOUR: VELOCITY / MATERIAL</b> toggle in the 3D toolbar switches every uncoloured leg between the '
        + 'velocity diagnostic (green in band, amber or red out of it) and the pipe\'s actual finish for the material '
        + 'chosen in section 4 &mdash; carbon steel grey, polished stainless, galvanized zinc, black HDPE, and so on. A '
        + 'leg you colour by hand on the sketch keeps that colour in both modes. A <b>FLUID: VISIBLE / HIDDEN</b> '
        + 'toggle beside it turns the flow animation off &mdash; useful for a clean drawing-only screenshot, or on a '
        + 'slower machine &mdash; without losing anything else in the model.</p>'
        + '<p>The <b>MOVE / PAN</b> tool (with LINE, SELECT/DRAG and DELETE) works the same way in both views: in 2D it '
        + 'drags the whole drawing to a new spot on the canvas without touching anything on it &mdash; the same as '
        + 'holding Shift or the middle mouse button in any other tool, just easier to find. In the 3D view, picking '
        + 'MOVE / PAN switches drag from orbiting the model to sliding the whole view instead, so you can recentre a '
        + 'long run before rotating around it again &mdash; switch back to SELECT/DRAG (or any other tool) to go back '
        + 'to orbiting. A <b>BACKGROUND</b> colour swatch on the toolbar sets the canvas/3D colour directly &mdash; '
        + 'useful against a bright screenshot or a printed page.</p>';

      h += '<h4 class="aro-doc-h">Step 7 &mdash; Run</h4>'
        + '<p>Press <b>RUN ' + esc(cfg.runLabel || 'LINE SIZING') + '</b>. The banner above the button turns green for a '
        + 'design that clears every check, or amber for one that needs review, and states the bore, length, velocity '
        + 'and pressure drop it ran with.</p>';

      h += '<h4 class="aro-doc-h">Reading the results</h4><ul class="aro-doc-ul">' + cfg.manualChecks
        + '<li><b>Downstream pressure</b> &mdash; the upstream pressure entered in section 3, less friction, static and '
        + 'fitting losses. A negative figure means the line as drawn cannot deliver flow at all against that upstream '
        + 'pressure, and is flagged rather than shown as an ordinary result.</li>'
        + '</ul>';

      h += '<h4 class="aro-doc-h">Auto-design &amp; suggestions</h4>'
        + '<p>When a check fails, <b>DESIGN UPGRADE SUGGESTIONS</b> lists each correction with the reasoning behind it '
        + 'and, where one applies directly to an input, an <b>APPLY</b> button. <b>&#9881; AUTO-STABILISE DESIGN</b> sweeps '
        + 'every ASME B36.10M bore and schedule in one step and adopts the smallest that satisfies velocity, erosion and '
        + 'pressure drop together. When every check already passes you get a green '
        + '<b>&ldquo;&#10003; STABILISED DESIGN &mdash; every check satisfied&rdquo;</b> banner instead, naming the bore it '
        + 'passed at, so a clear design reads as clearly as a failing one.</p>';

      h += '<h4 class="aro-doc-h">Report</h4>'
        + '<p>Download the PDF from the report button. It carries the design data sheet, physical properties, pipe '
        + 'data, the design-validation checklist and, in MANUAL mode, the P&amp;ID sketch and the 3D model, in '
        + 'whichever unit system is active.</p>';

      if (cfg.manualNote) h += '<div class="aro-doc-callout aro-doc-callout--warn">' + cfg.manualNote + '</div>';

      h += '</div></div></details>';
      return h;
    }

    /* ── the calculation common to every stream ── */
    function compute() {
      var props = cfg.props(g, t) || {};
      var rho = props.rho, mu = props.mu, Q = props.Q, W = props.W;

      var nps = parseFloat(t('nps', String(cfg.dNps || 2)));
      var sch = t('sch', cfg.dSch || '40');
      var b = bore(nps, sch);
      var matName = t('mat', 'CS');
      var mrec = MAT[matName] || MAT['CS'];
      var eps = (mrec[0] != null) ? mrec[0] : g('eps', NaN);
      var kMat = (mrec[1] != null) ? mrec[1] : g('kmat', NaN);

      var V = (Q * 1e6) / (3600 * 0.785 * b.Dmm * b.Dmm);
      var Re = (rho * V * b.D) / (0.001 * mu);
      var f = friction(Re, eps, b.Dmm);

      /* Velocity band and allowance for this service. */
      var band = cfg.band(t, g, props) || {};
      /* A typed velocity limit or ΔP allowance is an OVERRIDE, not a
         suggestion. The band came from the service table and the fields were
         only consulted when the service had no entry, so on any named
         service an engineer could type a ceiling and watch nothing happen —
         a silently ignored input. It also made the design-closure lever
         meaningless: the panel would offer to widen the ceiling, write the
         number in, and the check would still fail against the old band.
         A blank field still falls back to the service default. */
      var vMinOv = g('vmin', NaN), vMaxOv = g('vmax', NaN), dpOv = g('dpallow', NaN);
      if (isFinite(vMinOv)) band.min = vMinOv;
      if (isFinite(vMaxOv)) band.max = vMaxOv;
      if (isFinite(dpOv)) band.dp = dpOv;
      var vMin = band.min, vMax = band.max;
      var velMinOk = V > vMin, velMaxOk = V < vMax;
      var sizeAdvice = V < vMin ? 'Reduce pipe size' : V > vMax ? 'Increase pipe size' : 'Accept pipe size';

      /* Erosional velocity, API RP 14E form used by every workbook. */
      var rhoLb = rho / 16.0185;
      var C = cfg.cfactor ? cfg.cfactor(t, g) : NaN;
      var VeFt = C / Math.sqrt(rhoLb), Ve = VeFt * 0.3048;
      var pct = g('pcterosion', cfg.dPct == null ? 75 : cfg.dPct);
      var Vallow = cfg.noPct ? Ve : Ve * (pct / 100);
      var eroOk = V < Vallow;

      /* Pressure drop. */
      var L = g('len', cfg.dLen || 10), dz = g('dz', cfg.dDz || 0), dpEq = g('dpeq', 0.001);
      var dpFricPa = (f * L * rho * V * V) / (b.D * 2);
      var headLoss = dpFricPa / (rho * 9.81);
      var dpStatPa = rho * 9.81 * dz;

      var K = kBand(nps), sumK = 0, fitList = [];
      FIT_NAMES.forEach(function (n, i) {
        var q = g('fit-' + i, 0);
        if (q > 0) { sumK += K[i] * q; fitList.push({ name: n, qty: q, k: K[i], total: K[i] * q }); }
      });
      if (MODE === 'manual' && PIDSUM && PIDSUM.extraK) {
        sumK += PIDSUM.extraK;
        PIDSUM.extra.forEach(function (x) { fitList.push({ name: x.tag + ' ' + x.name, qty: 1, k: x.k, total: x.k }); });
      }
      var dpFitPa = 0.5 * sumK * rho * V * V;
      var dpTotal = (dpFricPa + dpStatPa + dpFitPa) / 1e5 + dpEq;
      var pUp = g('pup', cfg.dPup || 6);
      var pDown = pUp - dpTotal;
      var dpAllow = band.dp;
      var dpOk = !isFinite(dpAllow) ? true : dpTotal <= dpAllow;
      /* dpOk only fires when a per-100m allowable is actually stated — most
         runs leave that blank, so a line whose fittings and friction eat more
         pressure than is actually available upstream sailed through with no
         check at all, showing a negative "downstream pressure" as if it were
         a normal result. This is independent of dpAllow: whatever the stated
         allowance, the line only works if there is pressure left to deliver. */
      var pDownOk = !isFinite(pDown) || pDown >= 0;

      var r = {
        props: props, rho: rho, mu: mu, Q: Q, W: W, rhoLb: rhoLb,
        nps: nps, sch: sch, idIn: b.idIn, odIn: b.odIn, thkIn: b.thkIn, Dmm: b.Dmm, D: b.D,
        matName: matName, eps: eps, kMat: kMat, relRough: eps / b.Dmm,
        V: V, Re: Re, flow: behaviour(Re), f: f,
        vMin: vMin, vMax: vMax, velMinOk: velMinOk, velMaxOk: velMaxOk, velOk: velMinOk && velMaxOk, sizeAdvice: sizeAdvice,
        C: C, VeFt: VeFt, Ve: Ve, pct: pct, Vallow: Vallow, eroOk: eroOk,
        /* Momentum flux and the erosional screening, from the SHARED engine
           and from the density, velocity and actual bore this calculation
           already produced — nothing is recomputed here, so the figure can
           never disagree with the hydraulics it came from. */
        mom: (window.AROMOM ? window.AROMOM.calculateFlowMomentumCheck({
          flowType: t('fluid', cfg.title), phase: cfg.momPhase || 'liquid',
          density: rho, velocity: V,
          C_factor: C, service: t('cservice', 'user'),
          allowableVelocity: Vallow,
          limitPa: (function () { var q = g('momlimit', NaN); return isFinite(q) && q > 0 ? q * 1000 : NaN; })(),
          basis: 'Density and velocity are the flowing values used for the pressure drop, '
               + 'on the actual internal diameter (' + b.Dmm.toFixed(1) + ' mm).'
        }) : null),
        L: L, dz: dz, dpEq: dpEq, dpFricPa: dpFricPa, headLoss: headLoss, dpStatPa: dpStatPa,
        sumK: sumK, fitList: fitList, dpFitPa: dpFitPa,
        dpTotal: dpTotal, pUp: pUp, pDown: pDown, dpAllow: dpAllow, dpOk: dpOk, pDownOk: pDownOk,
        svc: t('svc', ''), mode: MODE
      };
      if (cfg.extra) cfg.extra(r, g, t);
      return r;
    }

    /* ── panel markup ── */
    function panelHTML() {
      var h = '<div class="sthe-grid">';
      h += '<div class="panel panel-input" style="max-height:calc(100vh - 200px);overflow-y:auto;overflow-x:hidden;">'
        + '<div class="panel-header" style="display:flex;align-items:center;gap:6px;"><span class="panel-title" style="flex:1;">' + esc(cfg.title) + ' — DESIGN INPUTS</span>'
        + '<button id="' + id('undo') + '" class="aln-hbtn" title="Undo"><span style="font-size:13px;">↩</span><span>UNDO</span></button>'
        + '<button id="' + id('redo') + '" class="aln-hbtn" title="Redo"><span style="font-size:13px;">↪</span><span>REDO</span></button>'
        + '<button id="' + id('reset') + '" class="aln-hbtn aln-red" title="Reset"><span style="font-size:13px;">↺</span><span>RESET</span></button></div>'
        + '<div class="panel-body">';

      h += manualHTML();
      h += dataSheet();

      h += cfg.inputs(H);                                  // sections 2 and 3, per stream

      h += hdr('4 · PIPE DATA');
      h += two(sel('NPS', 'nps', Object.keys(PIPE), String(cfg.dNps || 2)), sel('SCHEDULE', 'sch', SCHEDULES, cfg.dSch || '40'));
      h += sel('PIPE MATERIAL', 'mat', Object.keys(MAT), cfg.dMat || 'CS');
      h += '<div id="' + id('matuser') + '" style="display:none;">' + fld('Absolute roughness ε', 'eps', 'mm', '', '0.001')
        + (cfg.usesKmat ? fld('Erosion factor K', 'kmat', 'm/s', '', '0.1') : '') + '</div>';
      h += '<div id="' + id('pipeinfo') + '" style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;margin-top:2px;"></div>';
      h += '<label style="display:flex;align-items:center;gap:6px;margin-top:6px;padding:6px 8px;border:1px solid #22c55e;border-radius:4px;background:rgba(34,197,94,0.06);cursor:pointer;">'
        + '<input type="checkbox" id="' + id('autofix') + '" style="accent-color:#22c55e;"/>'
        + '<span style="font-family:var(--font-mono);font-size:9.5px;font-weight:700;color:#22c55e;line-height:1.4;">AUTO-DESIGN MODE — hold the line at the smallest bore that passes every check</span></label>';
      h += two(fld('Line length', 'len', 'm', cfg.dLen || 10, '0.5'), fld('Static height Δz', 'dz', 'm', cfg.dDz || 0, '0.1'));
      h += fld('Equipment / vendor ΔP', 'dpeq', 'bar', 0.001, '0.001');

      h += hdr('5 · ' + (cfg.eroTitle || 'EROSIONAL VELOCITY (API RP 14E)'));
      h += cfg.erosion(H);
      if (!cfg.noPct) h += fld('% of erosional velocity', 'pcterosion', '%', cfg.dPct == null ? 75 : cfg.dPct, '1');

      h += '<div id="' + id('fithdr') + '">' + hdr('6 · FITTINGS &amp; VALVES (quantity)') + '</div>';
      h += '<div id="' + id('fitchips') + '" style="display:none;margin-bottom:6px;"></div>';
      h += '<div id="' + id('fitnote') + '" style="display:none;font-family:var(--font-mono);font-size:9px;color:#38bdf8;line-height:1.5;background:rgba(56,189,248,0.07);border-left:2px solid #38bdf8;padding:5px 7px;border-radius:3px;margin-bottom:5px;"></div>';
      /* Each fitting carries its own symbol. "Plug valve 3-way through" and
         "Plug valve branch flow" are different castings with different K, and
         the wording alone was the only thing telling them apart. */
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
      FIT_NAMES.forEach(function (n, i) {
        var ico = (window.AROSYM && window.AROSYM.FIT[i])
          ? '<span class="ls-fitico">' + window.AROSYM.svg(window.AROSYM.FIT[i], { w: 42 }) + '</span>' : '';
        h += '<div>' + fld(ico + '<span class="ls-fitname">' + n + '</span>', 'fit-' + i, '', 0, '1') + '</div>';
      });
      h += '</div>';

      h += '<button id="' + id('calc') + '" style="width:100%;margin-top:14px;background:linear-gradient(135deg,#16a34a,#22c55e);border:none;color:#fff;font-family:var(--font-mono);font-size:12px;font-weight:800;letter-spacing:0.06em;padding:11px;border-radius:5px;cursor:pointer;">▶ RUN ' + esc(cfg.runLabel || 'LINE SIZING') + '</button>';
      h += '<div id="' + id('status') + '" style="display:none;margin-top:8px;font-family:var(--font-mono);font-size:10px;font-weight:700;color:#052e16;border-radius:5px;padding:8px 10px;text-align:center;line-height:1.4;"></div>';
      h += css();
      h += '</div></div>';

      h += '<div class="panel" style="max-height:calc(100vh - 200px);overflow-y:auto;">'
        + '<div class="panel-header"><span class="panel-title">TECHNICAL EVALUATIONS — ' + esc(cfg.title) + '</span></div>'
        + '<div class="panel-body">'
        + '<div id="' + id('3dblock') + '">'
        + '<div style="font-family:var(--font-mono);font-size:9.5px;color:#94a3b8;text-align:center;margin-bottom:4px;">3D LINE MODEL — LIVE · DRAG TO ROTATE · SCROLL TO ZOOM</div>'
        + '<div style="position:relative;width:100%;height:300px;background:#0b1220;border:1px solid var(--border-muted);border-radius:6px;overflow:hidden;">'
        + '<canvas id="' + id('canvas') + '" style="width:100%;height:100%;display:block;cursor:grab;"></canvas>'
        + '<div id="' + id('3dtag') + '" style="position:absolute;left:8px;top:8px;font-family:var(--font-mono);font-size:11px;font-weight:700;color:#38bdf8;"></div>'
        + '<div id="' + id('3dsub') + '" style="position:absolute;left:8px;top:26px;font-family:var(--font-mono);font-size:9px;color:#94a3b8;"></div>'
        + '<div id="' + id('3dext') + '" style="position:absolute;left:8px;top:42px;display:none;'
        + 'font-family:var(--font-mono);font-size:9px;color:#fbbf24;"></div>'
        + '<div id="' + id('3dscale') + '" class="aln-scale"></div></div>'
        + '<div id="' + id('bern') + '" class="aln-bern"></div></div>'
        + '<div id="' + id('pidblock') + '" style="display:none;"></div>'
        + '<div id="' + id('run') + '" style="display:none;margin-top:10px;font-family:var(--font-mono);font-size:11px;font-weight:800;border-radius:5px;padding:9px 11px;line-height:1.45;"></div>'
        + '<div id="' + id('advisor') + '" style="margin-top:12px;"></div>'
        + '<div id="' + id('results') + '" style="margin-top:12px;"></div>'
        + '<div style="margin-top:14px;border-top:1px solid var(--border-muted);padding-top:10px;">'
        + '<div style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin-bottom:6px;">FINAL DELIVERABLES</div>'
        + '<button id="' + id('report') + '" class="aln-act" style="width:100%;">📄 ' + esc(cfg.title) + ' REPORT</button></div>'
        + '</div></div>';
      return h + '</div>';
    }

    function css() {
      return '<style>'
        /* Fitting symbol sits on its own line above the name, so a two-column
           grid of eighteen fittings still fits without the names wrapping. */
        + '.ls-fitico{display:block;line-height:0;margin-bottom:1px;}'
        + '.ls-fitico svg{background:rgba(148,163,184,0.10);border:1px solid var(--border-muted);border-radius:3px;padding:1px 2px;}'
        + '.ls-fitname{display:block;line-height:1.25;}'
        + '.aln-act{background:transparent;border:1px solid var(--color-saffron);color:var(--color-saffron);font-family:var(--font-mono);font-size:10px;font-weight:700;padding:8px;border-radius:4px;cursor:pointer;}'
        + '.aln-act:hover{background:rgba(255,117,56,0.12);}'
        + '.aln-rr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--border-muted);font-family:var(--font-mono);font-size:11px;}'
        + '.aln-rr span{color:var(--text-muted);}.aln-rr b{color:var(--text-header);}.aln-rr.ok b{color:#22c55e;}.aln-rr.warn b{color:#ef4444;}.aln-rr.mid b{color:#f59e0b;}'
        + '.aln-cardh{font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin:12px 0 4px;}'
        /* ── Bernoulli station gauges under the 3D view ────────────────────
           The three terms of the energy equation at each end of the run,
           each as a share of the energy the fluid arrives with. Reading them
           side by side is what makes a line visibly trade pressure for
           velocity or for height, instead of it being a number in a table. */
        + '.aln-bern{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:start;margin-top:8px;'
        + 'background:#0b1220;border:1px solid var(--border-muted);border-radius:6px;padding:10px 12px;}'
        + '.aln-st{min-width:0;}'
        + '.aln-st-h{font-family:var(--font-mono);font-size:10px;font-weight:800;letter-spacing:0.08em;margin-bottom:6px;display:flex;justify-content:space-between;gap:6px;}'
        + '.aln-st-h i{font-style:normal;color:#64748b;font-weight:600;}'
        + '.aln-row{display:grid;grid-template-columns:58px 1fr 46px;gap:6px;align-items:center;margin-bottom:4px;}'
        + '.aln-row label{font-family:var(--font-mono);font-size:8.5px;color:#94a3b8;letter-spacing:0.03em;}'
        + '.aln-bar{height:9px;border-radius:5px;background:rgba(148,163,184,0.14);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.5);}'
        + '.aln-bar i{display:block;height:100%;border-radius:5px;transition:width .45s cubic-bezier(.4,0,.2,1);}'
        + '.aln-row b{font-family:var(--font-mono);font-size:10px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums;}'
        + '.aln-sub{font-family:var(--font-mono);font-size:8px;color:#64748b;margin:-2px 0 5px 64px;font-variant-numeric:tabular-nums;}'
        + '.aln-bp i{background:linear-gradient(90deg,#f87171,#ef4444);}.aln-bp b{color:#f87171;}'
        + '.aln-bv i{background:linear-gradient(90deg,#4ade80,#22c55e);}.aln-bv b{color:#4ade80;}'
        + '.aln-bh i{background:linear-gradient(90deg,#60a5fa,#3b82f6);}.aln-bh b{color:#60a5fa;}'
        + '.aln-mid{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:0 4px;'
        + 'border-left:1px dashed rgba(148,163,184,0.25);border-right:1px dashed rgba(148,163,184,0.25);min-width:104px;}'
        + '.aln-mid-t{font-family:var(--font-mono);font-size:8px;color:#64748b;letter-spacing:0.06em;}'
        + '.aln-mid-v{font-family:var(--font-mono);font-size:13px;font-weight:800;color:#fbbf24;font-variant-numeric:tabular-nums;}'
        + '.aln-mid-s{font-family:var(--font-mono);font-size:8px;color:#94a3b8;text-align:center;line-height:1.35;}'
        /* pressure colour key over the 3D view */
        + '.aln-scale{position:absolute;right:8px;bottom:8px;display:flex;align-items:center;gap:5px;'
        + 'font-family:var(--font-mono);font-size:8px;color:#94a3b8;background:rgba(2,6,18,0.6);padding:3px 6px;border-radius:4px;}'
        + '.aln-scale u{display:block;width:74px;height:7px;border-radius:4px;text-decoration:none;'
        + 'background:linear-gradient(90deg,#2563eb,#22d3ee,#22c55e,#facc15,#f97316,#ef4444);}'
        + '@media (max-width:760px){.aln-bern{grid-template-columns:1fr;}'
        + '.aln-mid{border:none;border-top:1px dashed rgba(148,163,184,0.25);border-bottom:1px dashed rgba(148,163,184,0.25);padding:6px 0;}}'
        + '.aln-hbtn{display:inline-flex;flex-direction:column;align-items:center;gap:1px;min-width:42px;padding:4px 8px;background:rgba(59,130,246,0.06);border:1px solid #3b82f6;color:#3b82f6;border-radius:5px;font-size:8px;font-weight:700;cursor:pointer;line-height:1.1;font-family:var(--font-mono);}'
        + '.aln-hbtn.aln-red{border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,0.06);}'
        + '</style>';
    }

    var row = function (k, v, cls) { return '<div class="aln-rr ' + (cls || '') + '"><span>' + k + '</span><b>' + v + '</b></div>'; };
    var R = { row: row, f1: f1, f2: f2, f3: f3, f4: f4, f0: f0, esc: esc, U: U, UG: UG, UB: UB, CV: CV, SYM: SYM };

    /* ── auto design ──────────────────────────────────────────────────────
       A verdict of "increase / reduce pipe size" is a finding, not an answer.
       AUTO-DESIGN MODE closes it: whenever a recalculation ends with any check
       failing, the smallest ASME B36.10M bore and schedule that satisfies them
       together is adopted straight away and the change is stated. Off, the same
       answer is offered inline at the verdict with one button. ── */
    var AUTOBUSY = false, AUTOMSG = '';

    function autoOn() { var e = $(id('autofix')); return !!(e && e.checked); }

    /* The stabilised design for the current inputs, worked out once per
       recalculation and reused by the fix bar and the advisor. */
    var BEST = null, BESTFOR = null;
    function bestFix(r) {
      var sig = [r.nps, r.sch, r.V, r.vMin, r.vMax, r.Vallow, r.dpTotal, r.dpAllow].join('|');
      if (BESTFOR === sig) return BEST;
      BESTFOR = sig; BEST = stabilise();
      return BEST;
    }

    function fixBar(r) {
      if (AUTOMSG) {
        var m = AUTOMSG; AUTOMSG = '';
        return '<div style="margin:6px 0;font-family:var(--font-mono);font-size:9.5px;font-weight:700;color:#22c55e;background:rgba(34,197,94,0.10);border-left:3px solid #22c55e;padding:7px 9px;border-radius:4px;line-height:1.5;">\u2699 AUTO-DESIGN &mdash; ' + esc(m) + '</div>';
      }
      if (allPass(r)) return '';
      var b = bestFix(r);
      var bad = checks(r).filter(function (c) { return !c.ok; })
        .map(function (c) { return c.label.toLowerCase(); }).join(', ');
      if (!b) {
        /* No bore works. Climb the ladder and say which decision is in the
           way, with the number, instead of handing back a shrug. */
        var L = ladder(r);
        var box = function (colour, tint, inner) {
          return '<div style="margin:6px 0;font-family:var(--font-mono);font-size:9.5px;color:#cbd5e1;background:' + tint
            + ';border-left:3px solid ' + colour + ';padding:7px 9px;border-radius:4px;line-height:1.55;">' + inner + '</div>';
        };

        if (L.kind === 'setpoint') {
          return box('#f59e0b', 'rgba(245,158,11,0.08)',
            '<b style="color:#f59e0b;">DESIGN UPGRADE &rarr; set point ' + L.pct + ' %, ' + L.best.nps + '\u2033 sch ' + esc(String(L.best.sch)) + '</b><br/>'
            + 'Failing: ' + esc(bad) + '. No bore can pass while the design is held at ' + f0(L.pctWas)
            + ' % of the erosional velocity &mdash; that set point alone caps the allowable at ' + U(r.Vallow, 'velocity', 2)
            + ' out of ' + U(r.Ve, 'velocity', 2) + '. API RP 14E is normally applied at 75\u2013100 % for a clean, non-erosive service. '
            + 'At ' + L.pct + ' % the smallest bore that satisfies every check is ' + L.best.nps + '\u2033 sch ' + esc(String(L.best.sch))
            + ' &mdash; velocity ' + U(L.best.r.V, 'velocity', 2) + ' against an allowable ' + U(L.best.r.Vallow, 'velocity', 2)
            + ', \u0394P ' + U(L.best.r.dpTotal, 'press-drop', 4) + '.'
            + '<br/><span style="color:#fbbf24;">This changes a design criterion, not a size, so it is never applied on its own &mdash; confirm the service really is clean and non-erosive first.</span>'
            + '<button id="' + id('fixpct') + '" data-pct="' + L.pct + '" data-nps="' + L.best.nps + '" data-sch="' + esc(String(L.best.sch)) + '"'
            + ' style="display:block;margin-top:6px;background:transparent;border:1px solid #f59e0b;color:#f59e0b;font-family:var(--font-mono);font-size:9px;font-weight:800;padding:4px 10px;border-radius:3px;cursor:pointer;">'
            + 'APPLY ' + L.pct + ' % &amp; ' + L.best.nps + '\u2033 SCH ' + esc(String(L.best.sch)) + '</button>');
        }

        var c = L.closest;
        return box('#ef4444', 'rgba(239,68,68,0.10)',
          '<b style="color:#fca5a5;">NO SIZE SATISFIES THIS DUTY</b><br/>'
          + 'Failing: ' + esc(bad) + '. The closest standard size is <b>' + (c ? c.nps + '\u2033 sch ' + esc(String(c.sch)) : '\u2014') + '</b>'
          + (c ? ' &mdash; velocity ' + U(c.r.V, 'velocity', 2) + ' against the ' + UB(c.r.vMin, c.r.vMax, 'velocity', 2)
                 + ' band and an erosional allowable of ' + U(c.r.Vallow, 'velocity', 2)
                 + ', \u0394P ' + U(c.r.dpTotal, 'press-drop', 4)
                 + (isFinite(c.r.dpAllow) ? ' against ' + U(c.r.dpAllow, 'press-drop', 4) + ' allowed' : '') + '.' : '.')
          + '<br/>No bore satisfies every check at this flow, so the size below is the closest '
          + 'compromise and not a pass. Every other way to close the design is listed underneath, '
          + 'each with the number it would take.'
          /* Until now this branch named the closest bore and then stopped,
             on the reasoning that offering a button would imply the design
             was fixed. But the engineer is left holding whatever size was on
             screen, which is normally further out than the closest one, and
             has to hand-select it themselves. The action is offered with
             what it still fails written on it, so it saves the selection
             without claiming to be a solution. */
          + (c ? '<button id="' + id('fixclose') + '" data-nps="' + c.nps + '" data-sch="' + esc(String(c.sch)) + '"'
              + ' style="display:block;margin-top:6px;background:transparent;border:1px solid #ef4444;color:#fca5a5;'
              + 'font-family:var(--font-mono);font-size:9px;font-weight:800;padding:4px 10px;border-radius:3px;cursor:pointer;">'
              + 'APPLY CLOSEST &mdash; ' + c.nps + '\u2033 SCH ' + esc(String(c.sch))
              + ' (still fails: ' + esc(checks(c.r).filter(function (q) { return !q.ok; })
                  .map(function (q) { return q.label.toLowerCase(); }).join(', ') || 'nothing') + ')</button>' : ''));
      }
      if (b.nps === r.nps && String(b.sch) === String(r.sch)) return '';
      return '<div style="margin:6px 0;font-family:var(--font-mono);font-size:9.5px;color:#cbd5e1;background:rgba(245,158,11,0.08);border-left:3px solid #f59e0b;padding:7px 9px;border-radius:4px;line-height:1.55;">'
        + '<b style="color:#f59e0b;">AUTO DESIGN &rarr; ' + b.nps + '\u2033 sch ' + esc(String(b.sch)) + '</b><br/>'
        + 'Failing now: ' + esc(bad) + '. This is the smallest size in the ASME B36.10M range that satisfies every check together &mdash; velocity ' + f2(b.r.V) + ' m/s inside the ' + f2(b.r.vMin) + '\u2013' + f2(b.r.vMax) + ' m/s band, ' + f2(b.r.V) + ' m/s against an allowable ' + f2(b.r.Vallow) + ' m/s, \u0394P ' + f4(b.r.dpTotal) + ' bar.'
        + '<button id="' + id('fixnow') + '" style="display:block;margin-top:6px;background:transparent;border:1px solid #f59e0b;color:#f59e0b;font-family:var(--font-mono);font-size:9px;font-weight:800;padding:4px 10px;border-radius:3px;cursor:pointer;">APPLY ' + b.nps + '\u2033 SCH ' + esc(String(b.sch)) + '</button></div>';
    }

    /* Validate required inputs before RUN — reads cfg.required (set per
       stream type below: liquid/gas/steam/slurry each name their own real
       field ids and labels, since 'q'/'rho'/'mu' aren't even the same
       suffixes across the four). Runs on every click, not just the first,
       so the gate can't be silently bypassed by pressing RUN twice. */
    function validateLineInputs() {
      var missing = [];
      var req = cfg.required || [];
      req.forEach(function (inp) {
        var el = $(id(inp.n));
        if (!el) return;
        /* zero is a blank for a flow, but a real value for a temperature
           or a gauge pressure — AROVALID decides by the quantity */
        if (window.AROVALID ? window.AROVALID.missing(el)
                            : !isFinite(parseFloat(el.value)) || parseFloat(el.value) === 0) missing.push(inp.label);
      });
      return missing;
    }

    /* Show required inputs dialog — same visual pattern as the pump-hydraulics
       and tank modules. Shown every time RUN is pressed while inputs are
       still missing (not gated to once per session), so a second press
       always explains itself instead of quietly doing nothing. */
    function showLineInputsDialog(missing) {
      if (window.__aroBackgroundRun) return;   // a re-run is not a request to design
      var old = $(id('reqinput-modal')); if (old) old.remove();
      var m = document.createElement('div'); m.id = id('reqinput-modal');
      m.style.cssText = 'position:fixed;inset:0;z-index:100003;background:rgba(2,6,18,0.92);display:flex;align-items:center;justify-content:center;';
      var inner = '<div style="background:#0f172a;border:2px solid #ef4444;border-radius:8px;max-width:520px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.8);">'
        + '<div style="font-size:20px;font-weight:800;color:#ef4444;margin-bottom:16px;display:flex;align-items:center;gap:10px;"><span style="font-size:24px;">⚠</span> REQUIRED INPUTS MISSING</div>'
        + '<div style="font-size:13px;color:#cbd5e1;margin-bottom:16px;line-height:1.6;">Enter values for the following before running ' + esc(cfg.runLabel || cfg.title) + ' — without them the result would be built on the module\'s example numbers, not your actual line data:</div>'
        + '<ul style="list-style:none;padding:0;margin:0 0 16px 0;">';
      missing.forEach(function (m) {
        inner += '<li style="font-family:var(--font-mono);font-size:12px;color:#f87171;margin:6px 0;padding-left:24px;">• ' + esc(m) + '</li>';
      });
      inner += '</ul>'
        + '<button id="' + id('reqinput-ok') + '" style="width:100%;background:linear-gradient(135deg,#ea580c,#f97316);border:none;color:#fff;font-family:var(--font-mono);font-size:14px;font-weight:800;padding:14px;border-radius:5px;cursor:pointer;">OK, I\'LL FILL THEM IN</button>'
        + '</div>';
      m.innerHTML = inner;
      document.body.appendChild(m);
      var okBtn = $(id('reqinput-ok'));
      if (okBtn) okBtn.onclick = function () { m.remove(); };
      m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    }

    /* ── results ──
       calc() is the pass boundary: the form is read once here and reused for
       the whole recalculation, including every trial the size search runs.
       Re-entrant because applying a fix calls calc() from inside calc(). */
    function calc() {
      if (PASS) return calcBody();
      passOpen();
      try { return calcBody(); } finally { passShut(); }
    }
    function calcBody() {
      if (!$(id('results'))) return;
      /* Nothing is shown after a reset until the engineer supplies inputs —
         otherwise validation, suggestions and the 3D refill from defaults and
         read as leftovers from the previous design. */
      if (window.ARORESET && window.ARORESET.is(P)) {
        window.ARORESET.placeholder($(id('results')), cfg.title.toLowerCase());
        var a0 = $(id('advisor')); if (a0) a0.innerHTML = '';
        var s0 = $(id('status')); if (s0) { s0.style.display = 'none'; s0.textContent = ''; }
        var r0 = $(id('run')); if (r0) { r0.style.display = 'none'; r0.textContent = ''; }
        if (three) { while (three.group.children.length) { var c0 = three.group.children.pop(); if (c0.geometry) c0.geometry.dispose(); } three.anim = null; }
        var tg0 = $(id('3dtag')), sb0 = $(id('3dsub'));
        if (tg0) tg0.textContent = ''; if (sb0) sb0.textContent = '';
        /* The station gauges and the pressure key are part of the animation
           window and have to go with it. Clearing the 3D group but leaving
           these behind left the previous design's inlet and outlet pressures
           sitting under an empty canvas, which is exactly the "leftovers from
           the last design" this branch exists to prevent. */
        var bn0 = $(id('bern')); if (bn0) bn0.innerHTML = '';
        var sc0 = $(id('3dscale')); if (sc0) sc0.innerHTML = '';
        var ex0 = $(id('3dext')); if (ex0) { ex0.textContent = ''; ex0.style.display = 'none'; }
        highlightFittings(P + '-', FIT_NAMES, id('fitchips'));
        return;
      }
      var r = LAST = compute();

      /* Auto-design closes a failing verdict before anything is drawn, so the
         results the engineer reads are already a design that passes. */
      if (!AUTOBUSY && autoOn() && !allPass(r)) {
        var fix = bestFix(r);
        if (fix && (fix.nps !== r.nps || String(fix.sch) !== String(r.sch))) {
          AUTOMSG = 'held at ' + fix.nps + '\u2033 sch ' + fix.sch + ' (was ' + r.nps + '\u2033 sch ' + r.sch
            + ') \u2014 the smallest bore that satisfies every check at this duty.';
          AUTOBUSY = true;
          $(id('nps')).value = fix.nps; $(id('sch')).value = fix.sch;
          AUTOBUSY = false;
          passDrop();                    // the form just changed under the cache
          r = LAST = compute();
        }
      }
      var h = '';

      h += '<div class="aln-cardh">PIPE &amp; VELOCITY</div>';
      h += row('NPS / schedule', r.nps + '" Sch ' + r.sch);
      h += row('OD / ID / thickness', f3(r.odIn) + ' / ' + f3(r.idIn) + ' / ' + f3(r.thkIn) + ' in');
      h += row('Internal diameter', U(r.Dmm, 'length-mm', 2));
      h += row('Roughness ε / relative', U(r.eps, 'length-mm', 4) + ' / ' + (isFinite(r.relRough) ? r.relRough.toExponential(3) : '—'));
      h += row('Design volumetric flow', U(r.Q, 'vol-flow', 3));
      h += row('Mass flow', U(r.W, 'mass-flow', 1));
      h += row('Line velocity', U(r.V, 'velocity', 3), r.velOk ? 'ok' : 'mid');
      h += row('Velocity band for ' + esc(r.svc), UB(r.vMin, r.vMax, 'velocity', 2));
      h += row('Minimum range met', r.velMinOk ? 'YES' : 'NO', r.velMinOk ? 'ok' : 'warn');
      h += row('Maximum range met', r.velMaxOk ? 'YES' : 'NO', r.velMaxOk ? 'ok' : 'warn');
      h += row('Size verdict', r.sizeAdvice, /Accept/.test(r.sizeAdvice) ? 'ok' : 'mid');
      h += fixBar(r);

      if (cfg.rows) h += cfg.rows(r, R);

      h += '<div class="aln-cardh">' + (cfg.eroTitle || 'EROSIONAL VELOCITY (API RP 14E)') + '</div>';
      if (cfg.eroRows) h += cfg.eroRows(r, R);
      else {
        h += row('Service / C factor', esc(t('cservice', '—')) + '  ·  C = ' + f0(r.C));
        h += row('Erosional velocity', U(r.Ve, 'velocity', 3));
        if (!cfg.noPct) h += row('Design set point', f0(r.pct) + ' %');
        h += row('Allowable velocity', U(r.Vallow, 'velocity', 3));
      }
      h += row('Actual < allowable', r.eroOk ? 'YES' : 'NO', r.eroOk ? 'ok' : 'warn');

      /* One shared component for all five modules — see lib/aro-momentum.js.
         Momentum is reported, not used to reject a line: for a liquid the
         governing checks are velocity and pressure drop, and the engine says
         so rather than inventing a universal allowable. */
      if (r.mom && window.AROMOM) {
        h += window.AROMOM.render(r.mom, {
          num: function (v, d) { return isFinite(v) ? v.toFixed(d == null ? 2 : d) : '—'; },
          vel: function (v) { return U(v, 'velocity', 2); },
          rho: function (v) { return isFinite(v) ? f2(v) + ' kg/m³' : '—'; }
        });
      }

      h += '<div class="aln-cardh">FLOW REGIME</div>';
      h += row('Reynolds number', f0(r.Re) + '  (' + r.flow + ')');
      h += row('Friction factor f', f4(r.f));

      h += '<div class="aln-cardh">PRESSURE DROP</div>';
      h += row('Darcy–Weisbach friction', U(r.dpFricPa / 1e5, 'press-drop', 4));
      h += row('Head loss', U(r.headLoss, 'length-m', 3));
      h += row('Static head (Δz ' + U(r.dz, 'length-m', 2) + ')', U(r.dpStatPa / 1e5, 'press-drop', 4));
      h += row('Equipment / vendor', U(r.dpEq, 'press-drop', 4));
      h += row('Fittings ΣK', f2(r.sumK));
      h += row('Fittings loss', U(r.dpFitPa / 1e5, 'press-drop', 4));
      h += row('Total pressure drop', U(r.dpTotal, 'press-drop', 4), r.dpOk ? 'ok' : 'warn');
      h += row('Allowable ΔP', isFinite(r.dpAllow) ? U(r.dpAllow, 'press-drop', 3) : 'not specified');
      h += row('Downstream pressure', UG(r.pDown, 'pressure', 3, '(G)'), r.pDownOk ? null : 'warn');
      h += row('Thumb rule ΔP within allowance', isFinite(r.dpAllow) ? (r.dpOk ? 'YES' : 'NO') : '—', r.dpOk ? 'ok' : 'warn');

      if (r.fitList.length) {
        h += '<div class="aln-cardh">FITTING SCHEDULE</div>';
        h += '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10px;">'
          + '<tr style="color:#94a3b8;border-bottom:1px solid var(--border-muted);"><th style="text-align:left;padding:3px;">Item</th><th style="text-align:right;padding:3px;">Qty</th><th style="text-align:right;padding:3px;">K each</th><th style="text-align:right;padding:3px;">ΣK</th></tr>';
        r.fitList.forEach(function (x) {
          h += '<tr style="border-bottom:1px dashed var(--border-muted);color:var(--text-header);"><td style="padding:3px;">' + esc(x.name) + '</td>'
            + '<td style="padding:3px;text-align:right;">' + x.qty + '</td><td style="padding:3px;text-align:right;">' + x.k + '</td>'
            + '<td style="padding:3px;text-align:right;">' + f2(x.total) + '</td></tr>';
        });
        h += '</table>';
      }
      $(id('results')).innerHTML = h;
      var fx = $(id('fixnow'));
      if (fx) fx.addEventListener('click', function () {
        var b = BEST; if (!b) return;
        pushUndo();
        $(id('nps')).value = b.nps; $(id('sch')).value = b.sch;
        calc(); updHist();
      });

      /* The closest achievable bore. It does not pass, and the button says
         so, but it spares the engineer hand-picking the best compromise out
         of the whole B36.10M range. */
      var fc = $(id('fixclose'));
      if (fc) fc.addEventListener('click', function () {
        pushUndo();
        $(id('nps')).value = fc.getAttribute('data-nps');
        $(id('sch')).value = fc.getAttribute('data-sch');
        AUTOMSG = 'Taken to the closest achievable size, ' + fc.getAttribute('data-nps')
          + '\u2033 sch ' + fc.getAttribute('data-sch')
          + '. No bore satisfies every check at this duty \u2014 this is the smallest miss, not a pass.';
        calc(); updHist();
      });

      /* The set-point route changes a design criterion as well as a size, so
         it carries its own values on the button and is only ever reached by
         a deliberate click. */
      var fp = $(id('fixpct'));
      if (fp) fp.addEventListener('click', function () {
        pushUndo();
        var pe = $(id('pcterosion'));
        if (pe) pe.value = fp.getAttribute('data-pct');
        $(id('nps')).value = fp.getAttribute('data-nps');
        $(id('sch')).value = fp.getAttribute('data-sch');
        AUTOMSG = 'Erosional set point raised to ' + fp.getAttribute('data-pct')
          + ' % (API RP 14E clean-service range) and the bore taken to '
          + fp.getAttribute('data-nps') + '\u2033 sch ' + fp.getAttribute('data-sch') + '.';
        calc(); updHist();
      });

      var pi = $(id('pipeinfo'));
      if (pi) pi.textContent = 'OD ' + f3(r.odIn) + '" · ID ' + f3(r.idIn) + '" (' + U(r.Dmm, 'length-mm', 2) + ') · thk ' + f3(r.thkIn) + '" · ε ' + f4(r.eps) + ' mm';
      highlightFittings(P + '-', FIT_NAMES, id('fitchips'));
      renderAdvisor(r);
      update3D(r);
    }

    /* ── validation and advice ── */
    function checks(r) {
      var out = [
        { key: 'vel', ok: r.velOk, label: 'Line velocity', detail: U(r.V, 'velocity', 2) + ' against the ' + UB(r.vMin, r.vMax, 'velocity', 2) + ' band for ' + esc(r.svc) },
        { key: 'erode', ok: r.eroOk, label: 'Erosional velocity', detail: U(r.V, 'velocity', 2) + ' against an allowable ' + U(r.Vallow, 'velocity', 2) },
        { key: 'dp', ok: r.dpOk, label: 'Pressure drop', detail: U(r.dpTotal, 'press-drop', 4) + ' against ' + (isFinite(r.dpAllow) ? U(r.dpAllow, 'press-drop', 3) + ' allowable' : 'no stated allowance') },
        { key: 'pdown', ok: r.pDownOk, label: 'Downstream pressure', detail: r.pDownOk
            ? UG(r.pDown, 'pressure', 3, '(G)') + ' remains at the far end, against ' + UG(r.pUp, 'pressure', 2, '(G)') + ' entered upstream'
            : 'Friction, static and fitting losses (' + U(r.dpTotal, 'press-drop', 4) + ') exceed the ' + UG(r.pUp, 'pressure', 2, '(G)') + ' entered upstream — the line as specified cannot deliver flow without a pump or a larger bore' }
      ];
      if (cfg.checks) out = out.concat(cfg.checks(r, R));
      return out;
    }

    function suggestions(r) {
      var out = [];
      var sizes = Object.keys(PIPE).map(Number).sort(function (a, b) { return a - b; });
      var i = sizes.indexOf(r.nps);
      var up = i >= 0 && i < sizes.length - 1 ? sizes[i + 1] : null;
      var down = i > 0 ? sizes[i - 1] : null;
      if (r.V > r.vMax) out.push({ title: 'Increase bore to ' + (up ? up + '"' : 'the next size'),
        why: 'Velocity ' + U(r.V, 'velocity', 2) + ' is above the ' + U(r.vMax, 'velocity', 2) + ' ceiling for ' + esc(r.svc) + '. ' + (up ? 'One size up brings it into band.' : ''), apply: up });
      if (r.V < r.vMin) out.push({ title: 'Reduce bore to ' + (down ? down + '"' : 'the next size down'),
        why: 'Velocity ' + U(r.V, 'velocity', 2) + ' is below the ' + U(r.vMin, 'velocity', 2) + ' floor for ' + esc(r.svc) + ', so the line runs slack and anything carried in it can settle.', apply: down });
      if (!r.eroOk) out.push({ title: 'Increase bore to ' + (up ? up + '"' : 'the next size'),
        why: 'Velocity ' + U(r.V, 'velocity', 2) + ' exceeds the API RP 14E allowable of ' + U(r.Vallow, 'velocity', 2) + ' — erosion concentrates at the first bend downstream.', apply: up });
      if (!r.dpOk && isFinite(r.dpAllow)) {
        out.push({ title: 'Increase bore to ' + (up ? up + '"' : 'the next size'),
          why: 'Total ΔP ' + U(r.dpTotal, 'press-drop', 4) + ' exceeds the ' + U(r.dpAllow, 'press-drop', 3) + ' allowance. ΔP falls roughly with D⁻⁵, so one size up is usually enough.', apply: up });
        if (r.dpFitPa > r.dpFricPa) out.push({ title: 'Reduce fittings on the run',
          why: 'Fittings contribute ' + U(r.dpFitPa / 1e5, 'press-drop', 4) + ' against ' + U(r.dpFricPa / 1e5, 'press-drop', 4) + ' of straight-pipe friction (ΣK ' + f2(r.sumK) + '). Long-radius bends or one fewer valve saves more than a size change.', apply: null });
      }
      if (!r.pDownOk) {
        out.push({ title: 'Increase bore to ' + (up ? up + '"' : 'the next size'),
          why: 'The line has no pressure left to deliver: ' + U(r.dpTotal, 'press-drop', 4) + ' of loss against only ' + UG(r.pUp, 'pressure', 2, '(G)') + ' entered upstream. A larger bore cuts friction loss roughly with D⁻⁵; otherwise raise the upstream pressure or add a pump.', apply: up });
      }
      /* Schedule is the cheaper lever when the NPS is already right. */
      if ((!r.eroOk || !r.dpOk || r.V > r.vMax) && r.sch !== '5') {
        var lighter = { '160': '80', '80': '40', '40': '10', '10': '5' }[r.sch];
        if (lighter && PIPE[r.nps] && PIPE[r.nps].s[lighter] !== undefined) {
          out.push({ title: 'Open the bore by moving to schedule ' + lighter + ' at ' + r.nps + '"',
            why: 'The internal diameter grows from ' + U(r.Dmm, 'length-mm', 2) + ' to ' + U(PIPE[r.nps].s[lighter] * 25.4, 'length-mm', 2)
              + ' on schedule ' + lighter + '. Velocity falls with D² and friction with D⁵, so this often clears the check without moving to the next NPS — provided the pressure rating still covers the duty.',
            applySch: lighter });
        }
      }
      /* A low erosional set point is a choice; when it is what is failing the
         line, say so and offer the figure the standard is normally used at. */
      if (!cfg.noPct && !r.eroOk && r.pct < 60) out.push({ title: 'Review the erosional set point — currently ' + f0(r.pct) + ' % of Ve',
        why: 'The allowable velocity is only ' + U(r.Vallow, 'velocity', 2) + ' because the design is held to ' + f0(r.pct)
          + ' % of the ' + U(r.Ve, 'velocity', 2) + ' erosional velocity. API RP 14E is normally applied at 75–100 % for a clean, non-erosive service; at 75 % the allowable becomes ' + f2(r.Ve * 0.75) + ' m/s with no change to the pipe.',
        applyPct: 75 });

      if (cfg.advice) out = out.concat(cfg.advice(r, R) || []);

      /* Backstop — whenever anything still fails, close with the stabilised
         design, so the engineer always has one change that resolves the lot
         rather than a list of partial fixes. */
      var open = checks(r).filter(function (c) { return !c.ok; });
      if (open.length) {
        var best = stabilise();
        var already = best && best.nps === r.nps && String(best.sch) === String(r.sch);
        if (!already) out.push({ title: best ? 'Adopt ' + best.nps + '" sch ' + best.sch + ' — clears every outstanding check'
                                             : 'No standard size clears every check at this duty',
          why: (best ? 'Still failing: ' + open.map(function (c) { return c.label.toLowerCase(); }).join(', ')
                     + '. Sweeping every ASME B36.10M bore and schedule, ' + best.nps + '" sch ' + best.sch
                     + ' is the smallest that satisfies them together — velocity ' + U(best.r.V, 'velocity', 2) + ', ΔP '
                     + U(best.r.dpTotal, 'press-drop', 4) + '.'
                   : 'Still failing: ' + open.map(function (c) { return c.label.toLowerCase(); }).join(', ')
                     + '. No bore in the ASME B36.10M range satisfies them all at this duty — reduce the flow, shorten the run, or revisit the service selection.'),
          apply: best ? best.nps : null, applySch: best ? best.sch : null });
      }
      return out;
    }

    /* trial() with any set of inputs overridden, so a lever other than bore
       and schedule can be explored. The form is not touched — see TRIAL
       above; the override is read as though the value had been typed in. */
    function trialWith(over) {
      var prev = TRIAL;
      TRIAL = over || null;
      try { return compute(); }
      finally { TRIAL = prev; }
    }
    function trial(nps, sch) { return trialWith({ nps: nps, sch: sch }); }
    function allPass(r) { return checks(r).every(function (c) { return c.ok; }); }

    function sizeSearch(over) {
      var sizes = Object.keys(PIPE).map(Number).sort(function (a, b) { return a - b; });
      for (var i = 0; i < sizes.length; i++) {
        for (var j = 0; j < SCHEDULES.length; j++) {
          if (PIPE[sizes[i]].s[SCHEDULES[j]] === undefined) continue;
          var o = { nps: sizes[i], sch: SCHEDULES[j] };
          for (var k in (over || {})) o[k] = over[k];
          var r = trialWith(o);
          if (allPass(r)) return { nps: sizes[i], sch: SCHEDULES[j], r: r };
        }
      }
      return null;
    }
    function stabilise() { return sizeSearch(null); }

    /* How badly a trial misses, as the sum of the relative overshoots on the
       checks that fail. Used only to name the closest achievable design when
       nothing passes — never to declare something acceptable. */
    function miss(r) {
      var m = 0;
      if (!r.velOk)  m += (r.V > r.vMax) ? (r.V - r.vMax) / Math.max(r.vMax, 1e-9)
                                         : (r.vMin - r.V) / Math.max(r.vMin, 1e-9);
      if (!r.eroOk)  m += (r.V - r.Vallow) / Math.max(r.Vallow, 1e-9);
      if (!r.dpOk && isFinite(r.dpAllow)) m += (r.dpTotal - r.dpAllow) / Math.max(r.dpAllow, 1e-9);
      if (!r.pDownOk) m += Math.abs(r.pDown) / Math.max(r.pUp, 1e-9);
      return m;
    }

    /* ── the design ladder ───────────────────────────────────────────────
       When no bore satisfies every check, the honest answer is not "reduce
       the flow" and nothing else. There is normally one design decision in
       the way, and it can be named with the number attached to it.

       Rung 1  bore and schedule. Pure sizing, nothing is given up, so this
               is the only rung AUTO-DESIGN mode applies on its own.
       Rung 2  the erosional set point. API RP 14E is normally applied at
               75–100 % for a clean, non-erosive service; a design held at
               20 % has crushed its own allowable velocity, and no bore can
               recover that. Raising it is a decision the engineer takes, so
               it is offered with the figure and never applied silently.
       Rung 3  neither works. Report the closest bore and exactly how far it
               misses, so the duty can be judged rather than guessed at.   */
    function ladder(cur) {
      var byS = sizeSearch(null);
      if (byS) return { kind: 'size', best: byS };

      if (!cfg.noPct) {
        var pctNow = cur.pct;
        var rungs = [];
        if (pctNow < 75) rungs.push(75);
        if (pctNow < 100) rungs.push(100);
        for (var i = 0; i < rungs.length; i++) {
          var got = sizeSearch({ pcterosion: rungs[i] });
          if (got) return { kind: 'setpoint', pct: rungs[i], pctWas: pctNow, best: got };
        }
      }

      /* Closest achievable, for the record. */
      var sizes = Object.keys(PIPE).map(Number).sort(function (a, b) { return a - b; });
      var bestM = null;
      for (var a2 = 0; a2 < sizes.length; a2++) {
        for (var b2 = 0; b2 < SCHEDULES.length; b2++) {
          if (PIPE[sizes[a2]].s[SCHEDULES[b2]] === undefined) continue;
          var rr = trialWith({ nps: sizes[a2], sch: SCHEDULES[b2] });
          var mm = miss(rr);
          if (bestM === null || mm < bestM.m) bestM = { m: mm, nps: sizes[a2], sch: SCHEDULES[b2], r: rr };
        }
      }
      return { kind: 'none', closest: bestM };
    }

    /* ── DESIGN CLOSURE ────────────────────────────────────────────────────
       Bore and schedule alone often cannot close a design, and when they
       cannot the panel used to stop at "no size satisfies this duty". That
       is true and useless: there is always something that WOULD close it,
       and the engineer's job is to decide which thing to give up.

       So every remaining lever is solved for the smallest change that makes
       every check pass, and offered with the number attached. What separates
       them is not difficulty but AUTHORITY — who is entitled to move them:

         Bore and schedule      pure sizing, nothing is given up. This is the
                                only lever auto-design pulls on its own.
         Erosional set point    a design criterion. Offered with the figure.
         Velocity band          a service guideline, not a hard limit.
         ΔP allowance           a statement about the system, not the pipe.
         Route length           a plant layout change.
         Flow rate              the DUTY. Never applied by the software —
                                reported only, as the flow this line can
                                carry, because changing it silently changes
                                what the plant is being asked to do.
         Fittings / ΣK          reported as the ΣK that would close it; the
                                software cannot know which valve is optional.

       Each option is one click. Nothing above the first rung is ever applied
       without one. */
    function closureOptions(r) {
      var opts = [];
      if (allPass(r)) return opts;

      // sweep a lever until the bore search can close on it
      function solve(over, values) {
        for (var i = 0; i < values.length; i++) {
          var o = {}; for (var k in over) o[k] = over[k];
          o[over.__key] = values[i];
          delete o.__key;
          var got = sizeSearch(o);
          if (got) return { value: values[i], best: got };
        }
        return null;
      }
      function span(from, to, n) {
        var a = []; for (var i = 1; i <= n; i++) a.push(from + (to - from) * (i / n)); return a;
      }

      // 1 · erosional set point — already a rung, kept here for one list
      if (!cfg.noPct && isFinite(r.pct)) {
        var pctTry = [75, 85, 100].filter(function (v) { return v > r.pct + 0.5; });
        var gotPct = solve({ __key: 'pcterosion' }, pctTry);
        if (gotPct) opts.push({ lever: 'pcterosion', authority: 'criterion',
          label: 'Raise the erosional set point to ' + f0(gotPct.value) + ' %',
          set: { pcterosion: gotPct.value, nps: gotPct.best.nps, sch: gotPct.best.sch },
          gives: gotPct.best.nps + '″ sch ' + gotPct.best.sch,
          why: 'The set point alone caps the allowable at ' + U(r.Vallow, 'velocity', 2)
             + ' out of ' + U(r.Ve, 'velocity', 2) + '. API RP 14E is normally applied at '
             + '75–100 % for clean, non-erosive service. Confirm the service really is clean.' });
      }

      // 2 · velocity band — a service guideline
      if (isFinite(r.vMax) && r.V > r.vMax) {
        var gotV = solve({ __key: 'vmax' }, span(r.vMax, Math.max(r.vMax * 2.2, r.V * 1.15), 12));
        if (gotV) opts.push({ lever: 'vmax', authority: 'criterion',
          label: 'Widen the velocity ceiling to ' + U(gotV.value, 'velocity', 2),
          set: { vmax: gotV.value, nps: gotV.best.nps, sch: gotV.best.sch },
          gives: gotV.best.nps + '″ sch ' + gotV.best.sch,
          why: 'The band is a guideline for ' + esc(r.svc) + ', not a limit in a code. '
             + 'Widening it accepts more noise and more wear at the fittings.' });
      }
      if (isFinite(r.vMin) && r.V < r.vMin) {
        var gotVm = solve({ __key: 'vmin' }, span(r.vMin, Math.max(0.05, r.V * 0.9), 12));
        if (gotVm) opts.push({ lever: 'vmin', authority: 'criterion',
          label: 'Lower the velocity floor to ' + U(gotVm.value, 'velocity', 2),
          set: { vmin: gotVm.value, nps: gotVm.best.nps, sch: gotVm.best.sch },
          gives: gotVm.best.nps + '″ sch ' + gotVm.best.sch,
          why: 'Below the floor anything carried in the line can settle. Lower it only if '
             + 'the stream is genuinely clean and single-phase.' });
      }

      // 3 · ΔP allowance
      if (isFinite(r.dpAllow) && !r.dpOk) {
        var gotDp = solve({ __key: 'dpallow' }, span(r.dpAllow, Math.max(r.dpAllow * 4, r.dpTotal * 1.25), 14));
        if (gotDp) opts.push({ lever: 'dpallow', authority: 'criterion',
          label: 'Raise the ΔP allowance to ' + U(gotDp.value, 'press-drop', 4),
          set: { dpallow: gotDp.value, nps: gotDp.best.nps, sch: gotDp.best.sch },
          gives: gotDp.best.nps + '″ sch ' + gotDp.best.sch,
          why: 'The allowance is a statement about the system, not the pipe. Raising it '
             + 'has to be paid for by the pump or by the upstream pressure.' });
      }

      // 4 · route length — a layout change, but still one click
      if (isFinite(r.L) && r.L > 0) {
        var gotL = solve({ __key: 'len' }, span(r.L * 0.9, Math.max(0.5, r.L * 0.15), 12));
        if (gotL) opts.push({ lever: 'len', authority: 'layout',
          label: 'Shorten the run to ' + U(gotL.value, 'length-m', 1),
          set: { len: gotL.value, nps: gotL.best.nps, sch: gotL.best.sch },
          gives: gotL.best.nps + '″ sch ' + gotL.best.sch,
          why: 'Friction falls with length. This is a plant layout change, not a sizing one — '
             + 'the route has to actually be routable in that distance.' });
      }

      // 5 · flow — the duty. Reported, never applied.
      var qNow = g('q', NaN);
      if (isFinite(qNow) && qNow > 0) {
        var gotQ = solve({ __key: 'q' }, span(qNow * 0.95, qNow * 0.25, 14));
        if (gotQ) opts.push({ lever: 'q', authority: 'duty', readOnly: true,
          label: 'This line closes at ' + U(gotQ.value, 'vol-flow', 2) + ' instead of ' + U(qNow, 'vol-flow', 2),
          gives: gotQ.best.nps + '″ sch ' + gotQ.best.sch,
          why: 'Reported, not offered. The flow is the duty the plant asked for; the software '
             + 'does not get to change what the line is for. If the duty really can be reduced, '
             + 'change it in section 2 and the design closes at ' + gotQ.best.nps + '″ sch '
             + gotQ.best.sch + '.' });
      }

      /* 5b · COMBINED. One lever at a time is often not enough — a duty can
         sit outside the velocity band AND above the erosional allowable at
         the same time, so widening either alone still fails on the other,
         and the panel would report "nothing closes this" while a perfectly
         ordinary combination does. Take the bore that misses by least, then
         read off what every criterion would have to be for THAT bore to
         pass, and offer the whole set as one click. */
      if (!opts.some(function (o) { return o.authority === 'criterion'; })) {
        var sizes = Object.keys(PIPE).map(Number).sort(function (a, b) { return a - b; });
        var bestM = null;
        for (var a3 = 0; a3 < sizes.length; a3++) {
          for (var b3 = 0; b3 < SCHEDULES.length; b3++) {
            if (PIPE[sizes[a3]].s[SCHEDULES[b3]] === undefined) continue;
            var rr3 = trialWith({ nps: sizes[a3], sch: SCHEDULES[b3] });
            if (!rr3.pDownOk) continue;              // no pressure left is not a criterion problem
            var mm3 = miss(rr3);
            if (bestM === null || mm3 < bestM.m) bestM = { m: mm3, nps: sizes[a3], sch: SCHEDULES[b3], r: rr3 };
          }
        }
        if (bestM) {
          var c3 = bestM.r, set3 = { nps: bestM.nps, sch: bestM.sch }, moves = [];
          if (isFinite(c3.vMax) && c3.V > c3.vMax) {
            set3.vmax = Math.ceil(c3.V * 100) / 100;
            moves.push('velocity ceiling to ' + U(set3.vmax, 'velocity', 2));
          }
          if (isFinite(c3.vMin) && c3.V < c3.vMin) {
            set3.vmin = Math.floor(c3.V * 100) / 100;
            moves.push('velocity floor to ' + U(set3.vmin, 'velocity', 2));
          }
          if (!cfg.noPct && isFinite(c3.Ve) && c3.Ve > 0 && c3.V > c3.Vallow) {
            set3.pcterosion = Math.min(100, Math.ceil((c3.V / c3.Ve) * 100));
            moves.push('erosional set point to ' + f0(set3.pcterosion) + ' %');
          }
          if (isFinite(c3.dpAllow) && !c3.dpOk) {
            set3.dpallow = Math.ceil(c3.dpTotal * 10000) / 10000;
            moves.push('ΔP allowance to ' + U(set3.dpallow, 'press-drop', 4));
          }
          if (moves.length) {
            opts.unshift({ lever: 'combined', authority: 'criterion',
              label: 'Close the design at ' + bestM.nps + '″ sch ' + bestM.sch
                   + ' by relaxing ' + moves.join(', '),
              set: set3, gives: bestM.nps + '″ sch ' + bestM.sch,
              why: 'No single criterion closes this duty — the line sits outside more than one '
                 + 'limit at once, so each one on its own still fails on the others. This is the '
                 + 'smallest set of criteria that lets the closest bore pass together. Every figure '
                 + 'is a design decision: check each is defensible for ' + esc(c3.svc) + ' before '
                 + 'relying on it.' });
          }
        }
      }

      // 6 · fittings — reported as the ΣK that would close it
      if (isFinite(r.sumK) && r.sumK > 0 && r.dpFitPa > r.dpFricPa * 0.5) {
        opts.push({ lever: 'sumK', authority: 'layout', readOnly: true,
          label: 'Fittings carry ' + U(r.dpFitPa / 1e5, 'press-drop', 4) + ' of the drop (ΣK ' + f2(r.sumK) + ')',
          gives: '—',
          why: 'Long-radius bends, one fewer valve, or a straighter route cuts this directly. '
             + 'The software cannot know which fitting is optional, so it is reported rather '
             + 'than changed.' });
      }
      return opts;
    }

    var CLOSURE = [];
    var SUGG = [];

    /* ── WHEN THE CLOSURE SEARCH RUNS ──────────────────────────────────────
       closureOptions() sweeps the whole ASME B36.10M range once for every
       candidate value of every lever — around 3,400 trial designs when a duty
       fails on several checks at once. Making each trial cheap (see TRIAL and
       PASS above) took that from seconds to a few hundred milliseconds, but a
       few hundred milliseconds on every keystroke is still a panel that
       stutters while an engineer types a density.

       It does not have to run on every keystroke. The CALCULATION is what has
       to be live — velocity, ΔP, the verdict, the 3D — and that is instant.
       The closure list answers a different question, "what would make this
       pass", about a design the engineer is still in the middle of entering.
       It runs once the typing settles.

       What it must never do is show the previous design's answer as if it
       belonged to the current numbers. So the list is keyed to the result it
       was computed from: if the inputs have moved, the old list is dropped
       immediately and the panel says it is still working rather than leaving
       a stale recommendation on screen. */
    var CLOSEFOR = null, CLOSETIMER = null;
    function closureSig(r) {
      return [r.nps, r.sch, r.V, r.vMin, r.vMax, r.Ve, r.Vallow, r.pct,
              r.dpTotal, r.dpAllow, r.L, r.Q, r.pUp, r.sumK, r.rho, r.mu].join('|');
    }

    function renderAdvisor(r) {
      var el = $(id('advisor')); if (!el) return;
      var cs = checks(r), bad = cs.filter(function (c) { return !c.ok; });
      /* The same verdicts the panel is about to draw also feed the design
         status bar, so the header count and this list can never disagree. */
      if (window.AROENG) {
        try {
          window.AROENG.publish('line-' + cfg.tab, {
            checks: cs.map(function (c) {
              return { key: c.key, label: c.label, detail: c.detail, status: c.ok ? 'pass' : 'fail' };
            }),
            /* the result object itself, so the calculation trace is built
               from the numbers this run actually used rather than from a
               second, parallel copy that can drift */
            values: r
          });
        } catch (e) {}
      }
      var h = '<div class="aln-cardh">DESIGN VALIDATION</div>';
      cs.forEach(function (c) { h += '<div class="aln-rr ' + (c.ok ? 'ok' : 'warn') + '"><span>' + esc(c.label) + ' — ' + esc(c.detail) + '</span><b>' + (c.ok ? 'PASS' : 'FAIL') + '</b></div>'; });
      if (!bad.length) h += '<div style="margin-top:8px;font-family:var(--font-mono);font-size:10px;font-weight:700;color:#22c55e;background:rgba(34,197,94,0.10);border-left:3px solid #22c55e;padding:7px 9px;border-radius:4px;">✓ STABILISED DESIGN — every check satisfied at ' + r.nps + '" sch ' + esc(r.sch) + '.</div>';
      /* ── Design closure ──────────────────────────────────────────────
         When bore and schedule cannot close the design on their own, list
         every other lever with the smallest change that WOULD close it.
         Criteria are one click; the duty and the plant layout are reported
         but never applied by the software. */
      var sig = allPass(r) ? 'PASS' : closureSig(r);
      var pending = false;
      if (CLOSEFOR !== sig) {
        CLOSURE = [];                       // never show the last design's answer
        if (sig === 'PASS') CLOSEFOR = 'PASS';
        else {
          pending = true;
          clearTimeout(CLOSETIMER);
          CLOSETIMER = setTimeout(function () {
            CLOSETIMER = null;
            var r2 = LAST; if (!r2) return;
            var s2 = allPass(r2) ? 'PASS' : closureSig(r2);
            passOpen();
            try { CLOSEFOR = s2; CLOSURE = s2 === 'PASS' ? [] : closureOptions(r2); }
            finally { passShut(); }
            /* Filling the list in is a second publish for the same run. It
               must not read as a fresh calculation, or the suite scrolls the
               panel to the results a beat after the engineer stopped typing. */
            quietly(function () { renderAdvisor(r2); });
          }, 220);
        }
      }
      if (pending) {
        h += '<div class="aln-cardh" style="margin-top:12px;">DESIGN CLOSURE — WHAT WOULD MAKE THIS PASS</div>'
          + '<div style="font-family:var(--font-mono);font-size:9.5px;color:#94a3b8;background:rgba(148,163,184,0.06);'
          + 'border-left:3px solid #475569;padding:7px 9px;border-radius:4px;line-height:1.55;">'
          + 'Sweeping every bore and schedule against each design lever…</div>';
      }
      if (CLOSURE.length) {
        var actionable = CLOSURE.filter(function (o) { return !o.readOnly; });
        h += '<div class="aln-cardh" style="margin-top:12px;">DESIGN CLOSURE — WHAT WOULD MAKE THIS PASS'
          + '<span style="float:right;font-weight:700;color:#f59e0b;">' + actionable.length + ' one-click</span></div>';
        if (actionable.length > 1) {
          h += '<button id="' + id('closeall') + '" style="width:100%;margin:2px 0 8px;background:transparent;'
            + 'border:1px solid #22c55e;color:#22c55e;font-family:var(--font-mono);font-size:10px;font-weight:800;'
            + 'padding:7px;border-radius:4px;cursor:pointer;">⚙ APPLY THE SMALLEST SET THAT CLOSES THE DESIGN</button>';
        }
        CLOSURE.forEach(function (o, i) {
          var col = o.authority === 'duty' ? '#f87171' : o.authority === 'layout' ? '#7ea2d8' : '#f59e0b';
          var badge = o.authority === 'duty' ? 'DUTY — reported only'
            : o.authority === 'layout' ? 'LAYOUT' : 'DESIGN CRITERION';
          h += '<div style="border:1px solid var(--border-muted);border-left:3px solid ' + col
            + ';border-radius:4px;padding:7px 9px;margin:6px 0;background:rgba(148,163,184,0.04);">'
            + '<div style="font-family:var(--font-mono);font-size:8px;color:' + col + ';letter-spacing:0.07em;">' + badge + '</div>'
            + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:800;color:' + col + ';margin-top:2px;">'
            + esc(o.label) + (o.gives && o.gives !== '—' ? ' <span style="color:#94a3b8;font-weight:600;">→ ' + esc(o.gives) + '</span>' : '') + '</div>'
            + '<div style="font-family:var(--font-mono);font-size:9.5px;color:#cbd5e1;line-height:1.55;margin-top:3px;">' + esc(o.why) + '</div>'
            + (o.readOnly ? ''
              : '<button class="aln-close-apply" data-i="' + i + '" style="margin-top:5px;background:transparent;'
                + 'border:1px solid ' + col + ';color:' + col + ';font-family:var(--font-mono);font-size:9px;'
                + 'font-weight:700;padding:3px 9px;border-radius:3px;cursor:pointer;">APPLY</button>')
            + '</div>';
        });
      }

      SUGG = suggestions(r);
      if (SUGG.length) {
        h += '<div class="aln-cardh" style="margin-top:12px;">DESIGN UPGRADE SUGGESTIONS</div>';
        SUGG.forEach(function (s, i) {
          h += '<div style="border:1px solid var(--border-muted);border-left:3px solid #f59e0b;border-radius:4px;padding:7px 9px;margin:6px 0;background:rgba(245,158,11,0.05);">'
            + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:800;color:#f59e0b;">' + esc(s.title) + '</div>'
            + '<div style="font-family:var(--font-mono);font-size:9.5px;color:#cbd5e1;line-height:1.55;margin-top:3px;">' + esc(s.why) + '</div>'
            + ((s.apply || s.applySch || s.applyPct) ? '<button class="aln-apply" data-i="' + i + '" style="margin-top:5px;background:transparent;border:1px solid #f59e0b;color:#f59e0b;font-family:var(--font-mono);font-size:9px;font-weight:700;padding:3px 9px;border-radius:3px;cursor:pointer;">APPLY</button>' : '')
            + '</div>';
        });
      }
      h += '<button id="' + id('stab') + '" style="width:100%;margin-top:8px;background:transparent;border:1px solid #22c55e;color:#22c55e;font-family:var(--font-mono);font-size:10px;font-weight:800;padding:8px;border-radius:4px;cursor:pointer;">⚙ AUTO-STABILISE DESIGN</button>';
      h += '<div id="' + id('stabmsg') + '" style="display:none;margin-top:6px;font-family:var(--font-mono);font-size:9.5px;line-height:1.5;padding:7px 9px;border-radius:4px;"></div>';
      el.innerHTML = h;

      /* Design-closure buttons: one lever each, plus the smallest set. These
         are rendered into the ADVISOR block, so they have to be wired here —
         wiring them off the results element found nothing. */
      function applyClosure(setObj) {
        pushUndo();
        Object.keys(setObj).forEach(function (k) {
          var e2 = $(id(k)); if (e2) e2.value = setObj[k];
        });
        calc(); updHist();
      }
      [].slice.call(el.querySelectorAll('.aln-close-apply')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var o = CLOSURE[parseInt(btn.getAttribute('data-i'), 10)];
          if (!o || !o.set) return;
          AUTOMSG = o.label + ' — applied, and the bore taken to ' + o.gives + '.';
          applyClosure(o.set);
        });
      });
      var ca = $(id('closeall'));
      if (ca) ca.addEventListener('click', function () {
        /* Only the design criteria. The duty and the plant layout are the
           engineer's to move, so an apply-all must not quietly move them. */
        var set = {}, names = [];
        CLOSURE.forEach(function (o) {
          if (o.readOnly || o.authority !== 'criterion' || !o.set) return;
          Object.keys(o.set).forEach(function (k) { set[k] = o.set[k]; });
          names.push(o.label.toLowerCase());
        });
        if (!Object.keys(set).length) return;
        AUTOMSG = 'Design closed by ' + names.join('; ') + '. Layout and duty were left alone.';
        applyClosure(set);
      });

      [].slice.call(el.querySelectorAll('.aln-apply')).forEach(function (b) {
        b.addEventListener('click', function () {
          var s = SUGG[parseInt(b.getAttribute('data-i'), 10)];
          if (!s) return;
          pushUndo();
          if (s.apply) $(id('nps')).value = s.apply;
          if (s.applySch) $(id('sch')).value = s.applySch;
          if (s.applyPct) $(id('pcterosion')).value = s.applyPct;
          calc(); updHist();
        });
      });
      var sb = $(id('stab'));
      if (sb) sb.addEventListener('click', function () {
        var best = stabilise(), m = $(id('stabmsg'));
        if (m) m.style.display = 'block';
        if (!best) { if (m) { m.style.background = 'rgba(239,68,68,0.10)'; m.style.color = '#fca5a5';
          m.textContent = 'No pipe size in the ASME B36.10M range satisfies every check at this duty. Change the flow, shorten the run, or revisit the service selection.'; } return; }
        pushUndo();
        $(id('nps')).value = best.nps; $(id('sch')).value = best.sch;
        calc(); updHist();
        var m2 = $(id('stabmsg'));
        if (m2) { m2.style.display = 'block'; m2.style.background = 'rgba(34,197,94,0.10)'; m2.style.color = '#86efac';
          m2.textContent = 'Stabilised at ' + best.nps + '" sch ' + best.sch + ' — the smallest bore that passes velocity, erosion and pressure drop together.'; }
      });
    }

    function status() {
      var el = $(id('status')); if (!el || !LAST) return;
      var r = LAST, ok = r.velOk && r.eroOk && r.dpOk;
      el.style.display = 'block';
      el.style.background = ok ? 'linear-gradient(135deg,#22c55e,#4ade80)' : 'linear-gradient(135deg,#f59e0b,#fbbf24)';
      el.innerHTML = (ok ? '✓ DESIGN OK' : '⚠ REVIEW') + ' · ' + r.nps + '" Sch ' + r.sch + ' · V ' + U(r.V, 'velocity', 2) + ' · ΔP ' + U(r.dpTotal) + ' bar';
      var top = $(id('run'));
      if (top) {
        top.style.display = 'block';
        top.style.background = ok ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)';
        top.style.borderLeft = '3px solid ' + (ok ? '#22c55e' : '#f59e0b');
        top.style.color = ok ? '#86efac' : '#fbbf24';
        top.textContent = (ok ? '✓ RUN COMPLETE — design OK.  ' : '⚠ RUN COMPLETE — review needed.  ')
          + r.nps + '″ Sch ' + r.sch + ' · ' + U(r.L, 'length-m', 1) + ' · V ' + U(r.V, 'velocity', 2) + ' · ΔP ' + U(r.dpTotal, 'press-drop', 4)
          + (isFinite(r.dpAllow) ? ' of ' + f3(r.dpAllow) + ' allowable' : '')
          + (MODE === 'manual' ? '  ·  geometry and fitting counts from the P&ID' : '');
      }
    }

    /* ── 3D: the line drawn to its real bore and run ── */
    var three = null;
    function init3D() {
      if (typeof THREE === 'undefined') return;
      var canvas = $(id('canvas')); if (!canvas) return;
      var scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1220);
      var cam = new THREE.PerspectiveCamera(30, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.1, 600);
      var rn = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
      rn.setPixelRatio(window.devicePixelRatio || 1);
      scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2b3242, 1.05));
      var dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(10, 16, 12); scene.add(dl);
      var group = new THREE.Group(); scene.add(group);
      var sph = { r: 21, theta: 0.35, phi: 1.30, tx: 0, ty: 0 };
      function place() {
        var x = sph.r * Math.sin(sph.phi) * Math.sin(sph.theta), y = sph.r * Math.cos(sph.phi), z = sph.r * Math.sin(sph.phi) * Math.cos(sph.theta);
        cam.position.set(sph.tx + x, sph.ty + y, z); cam.lookAt(sph.tx, sph.ty, 0);
      }
      three = { scene: scene, cam: cam, rn: rn, group: group, sph: sph, place: place, canvas: canvas, anim: null };
      place();
      var down = null;
      canvas.addEventListener('mousedown', function (e) { down = { x: e.clientX, y: e.clientY, th: sph.theta, ph: sph.phi }; });
      window.addEventListener('mousemove', function (e) {
        if (!down) return;
        sph.theta = down.th - (e.clientX - down.x) * 0.01;
        sph.phi = Math.max(0.2, Math.min(Math.PI - 0.2, down.ph - (e.clientY - down.y) * 0.01));
        place();
      });
      window.addEventListener('mouseup', function () { down = null; });
      canvas.addEventListener('wheel', function (e) { e.preventDefault(); sph.r = Math.max(6, Math.min(90, sph.r * (e.deltaY < 0 ? 0.9 : 1.1))); place(); }, { passive: false });
      /* Every sub-tab used to build its own WebGL context and render loop the
         instant it was born, whether or not it was ever looked at — five
         permanently-live contexts (this suite's four streams plus Two-Phase)
         on a page that also carries PHE, Tank and the P&ID workbench, each
         with its own. Enough live contexts at once and the browser silently
         evicts one to make room for the next: the JS keeps running, tracer
         positions keep updating, but that context's render() calls become a
         no-op forever, and the pipe just looks solid and unmoving with no
         error anywhere. Skipping render() while the tab is hidden (offsetParent
         is null under display:none) can't undo an eviction that already
         happened, but it stops a background tab from burning a context slot
         on frames nobody sees, which is most of what caused the pile-up. */
      (function loop() {
        requestAnimationFrame(loop);
        if (!canvas.offsetParent) return;
        if (three && three.anim) three.anim();
        rn.render(scene, cam);
      })();
      window.addEventListener('resize', resize3D);
    }
    function resize3D() {
      if (!three) return; var c = three.canvas; if (!c || !c.clientWidth) return;
      three.cam.aspect = c.clientWidth / c.clientHeight; three.cam.updateProjectionMatrix();
      three.rn.setSize(c.clientWidth, c.clientHeight, false);
    }
    function sprite(txt, colour) {
      var c = document.createElement('canvas'), m = c.getContext('2d');
      m.font = 'bold 34px monospace';
      c.width = Math.max(64, m.measureText(txt).width + 20); c.height = 46;
      var x = c.getContext('2d');
      x.font = 'bold 34px monospace'; x.fillStyle = colour; x.textBaseline = 'middle';
      x.fillText(txt, 10, 23);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      sp.scale.set(c.width / 60, c.height / 60, 1);
      return sp;
    }

    /* ── Bernoulli at the two ends of the run ─────────────────────────────
       The energy the fluid carries splits three ways — the pressure pushing
       it, the speed it is already moving at, and the height it has been
       lifted to — and a line trades one for another. Showing the three terms
       at the inlet and again at the outlet is what makes that trade visible:
       a line that climbs converts pressure into height, and friction takes a
       slice of the total away between the two stations.

       The three terms are written as ENERGY PER UNIT VOLUME — p, ½ρV² and
       ρgz, all in pressure units — not as heads in metres. The head form
       divides by ρg, and for a gas that is a tiny number: a hydrogen line
       at 2 bar came out as 2,423,678 metres of head, which is arithmetically
       what the formula says and useless to read. It is also the wrong form
       for a compressible fluid in the first place. The pressure form is
       dimensionally the same statement, stays readable for every stream
       from slurry to hydrogen, and lands in the unit the rest of the panel
       already reports pressure in.

       Both stations are scaled against the SAME total — the energy arriving
       at the inlet — so the outlet's bars come up short by exactly what was
       lost. Scaling each station to its own total, the way a textbook
       diagram does, would make both add to 100 % and hide the loss, which is
       the one number a line-sizing engineer is here to see. */
    function renderBernoulli(r) {
      var host = $(id('bern')); if (!host) return;
      var rho = r && r.rho, V = r && r.V, G = 9.80665;
      if (!r || !isFinite(rho) || rho <= 0 || !isFinite(V)) { host.innerHTML = ''; return; }

      var eV = 0.5 * rho * V * V;                          // dynamic pressure, Pa
      var eP1 = (isFinite(r.pUp) ? r.pUp : 0) * 1e5;       // static, Pa (gauge)
      var eP2 = (isFinite(r.pDown) ? r.pDown : 0) * 1e5;
      var z2m = isFinite(r.dz) ? r.dz : 0;
      var eZ1 = 0, eZ2 = rho * G * z2m;                    // elevation, Pa
      /* A line whose losses exceed the pressure available runs out before the
         end. The arithmetic then hands back a negative outlet pressure, and
         reporting that straight through produced "-16.262 bar" in the outlet
         column and "163.3 % lost to friction" in the middle — both literally
         what the subtraction says, and neither a thing that can happen. The
         outlet is held at zero and the loss capped at everything there was,
         with the panel saying plainly that the line cannot deliver. */
      var starved = !isFinite(eP2) || eP2 < 0;
      if (starved) eP2 = 0;
      var H1 = eP1 + eV + eZ1;
      var H2 = eP2 + eV + eZ2;
      if (!isFinite(H1) || H1 <= 0) { host.innerHTML = ''; return; }
      var lost = Math.max(0, Math.min(H1, H1 - H2));

      var pc = function (h) { return Math.max(0, Math.min(100, (h / H1) * 100)); };
      // Pa → the active pressure unit; small terms need more decimals
      var mH = function (pa) {
        var bar = pa / 1e5;
        return U(bar, 'press-drop', Math.abs(bar) >= 1 ? 3 : Math.abs(bar) >= 0.01 ? 4 : 6);
      };

      function station(name, hp, hv, hz, note) {
        var rows = [
          ['aln-bp', 'Pressure', hp],
          ['aln-bv', 'Velocity', hv],
          ['aln-bh', 'Height', hz]
        ].map(function (x) {
          var p = pc(x[2]);
          /* On a real process line the pressure term dwarfs the other two —
             a 6 barg water line is 99 % pressure head — so a bar scaled
             honestly to the total leaves velocity and height as invisible
             slivers. The share is still what the bar length means, but a
             term that is present at all keeps a minimum mark, and the head
             in metres is printed beside it so a 1 % term is still a figure
             you can read and check. */
          var w = x[2] > 0 ? Math.max(2.5, p) : 0;
          return '<div class="aln-row ' + x[0] + '"><label>' + x[1] + '</label>'
            + '<div class="aln-bar"><i style="width:' + w.toFixed(1) + '%;"></i></div>'
            + '<b>' + (p >= 9.5 ? p.toFixed(0) : p.toFixed(1)) + '%</b></div>'
            + '<div class="aln-sub">' + mH(x[2]) + '</div>';
        }).join('');
        return '<div class="aln-st"><div class="aln-st-h" style="color:#f9a8d4;">' + name
          + '<i>' + note + '</i></div>' + rows + '</div>';
      }

      host.innerHTML =
        station('P1 · INLET', eP1, eV, eZ1, mH(H1) + ' total')
        + '<div class="aln-mid">'
        + '<div class="aln-mid-t">' + (starved ? 'NO PRESSURE LEFT' : 'LOST TO FRICTION') + '</div>'
        + '<div class="aln-mid-v"' + (starved ? ' style="color:#f87171;"' : '') + '>'
        + ((lost / H1) * 100).toFixed(1) + '%</div>'
        + '<div class="aln-mid-s">' + mH(lost)
        + (starved ? '<br><span style="color:#f87171;">line cannot deliver</span>' : '<br>irreversible')
        + '</div></div>'
        + station('P2 · OUTLET', eP2, eV, eZ2,
            starved ? 'runs dry before the end' : mH(H2) + ' total');
    }

    /* ── The route the engineer actually drew ─────────────────────────────
       Manual mode showed the same averaged straight tube the automatic mode
       does: one bore, one velocity, one ΔP, whatever had been routed on the
       P&ID beside it. A four-leg run with a riser and two different bores
       came back as a single pipe, which is the one picture that cannot tell
       an engineer where in their own line the pressure is going.

       Each leg is drawn at its own bore, on its own heading, coloured by the
       static pressure along THAT leg, and carries its own velocity and drop.
       The pressure at every joint is cumulative, so reading left to right
       down the run shows exactly where the pressure went, and which leg took
       it. Tracers move at each leg's own velocity, so a leg that necks down
       visibly speeds up. */
    function routeView(r, g) {
      var legs = PIDSUM.route;
      var SPAN = 23;                                   // world size of the run

      // total drawn extent, so the route can be scaled into the view
      var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      legs.forEach(function (l) {
        minX = Math.min(minX, l.x1, l.x2); maxX = Math.max(maxX, l.x1, l.x2);
        minY = Math.min(minY, l.y1, l.y2); maxY = Math.max(maxY, l.y1, l.y2);
      });
      var spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY);
      var k = SPAN / Math.max(spanX, spanY);
      var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

      // bore → world radius, keeping the relative sizes of the legs honest
      var maxD = 0;
      legs.forEach(function (l) { maxD = Math.max(maxD, l.Dmm || 0); });
      var rOf = function (l) {
        var f = maxD > 0 ? (l.Dmm || maxD) / maxD : 1;
        return Math.max(0.22, 0.62 * Math.sqrt(f));
      };

      // cumulative static pressure, inlet first
      var pUp = isFinite(r.pUp) ? r.pUp : 0;
      var acc = [], run = pUp * 1e5;
      legs.forEach(function (l) { acc.push({ a: run / 1e5, b: (run - (l.dpPa || 0)) / 1e5 }); run -= (l.dpPa || 0); });
      var pEnd = run / 1e5;
      var pLoR = Math.max(0, Math.min(pUp, pEnd)), pHiR = Math.max(pUp, pEnd);
      var flatR = (pHiR - pLoR) < 1e-9, spanP = Math.max(1e-9, pHiR - pLoR);
      var RAMP = [[37, 99, 235], [34, 211, 238], [34, 197, 94], [250, 204, 21], [249, 115, 22], [239, 68, 68]];
      function ramp(f) {
        f = Math.max(0, Math.min(0.9999, f));
        var i = Math.floor(f * (RAMP.length - 1)), t2 = f * (RAMP.length - 1) - i;
        var a = RAMP[i], b2 = RAMP[Math.min(RAMP.length - 1, i + 1)];
        return 'rgb(' + Math.round(a[0] + (b2[0] - a[0]) * t2) + ',' + Math.round(a[1] + (b2[1] - a[1]) * t2)
          + ',' + Math.round(a[2] + (b2[2] - a[2]) * t2) + ')';
      }
      function legTex(i) {
        var c = document.createElement('canvas'); c.width = 4; c.height = 128;
        var x = c.getContext('2d');
        for (var q = 0; q < 128; q++) {
          var u = q / 127;
          var pv = acc[i].a + (acc[i].b - acc[i].a) * u;
          x.fillStyle = flatR ? ramp(0.82) : ramp((pv - pLoR) / spanP);
          x.fillRect(0, q, 4, 1);
        }
        var t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
      }

      var parts = [];
      legs.forEach(function (l, i) {
        // the drawing's y grows downward; the view's grows upward
        var ax = (l.x1 - cx) * k, ay = -(l.y1 - cy) * k;
        var bx = (l.x2 - cx) * k, by = -(l.y2 - cy) * k;
        var dx = bx - ax, dy = by - ay;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (!(len > 0.01)) return;
        var mx = (ax + bx) / 2, my = (ay + by) / 2;
        var ang = Math.atan2(dy, dx);
        var rr = rOf(l);

        var fluid = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.82, rr * 0.82, len, 28, 1, false),
          new THREE.MeshStandardMaterial({ map: legTex(i), emissiveMap: legTex(i), emissive: 0xffffff,
            emissiveIntensity: 0.5, metalness: 0.05, roughness: 0.55 }));
        fluid.position.set(mx, my, 0);
        fluid.rotation.z = ang - Math.PI / 2;
        g.add(fluid);

        var wallCol = (isFinite(l.V) && isFinite(r.Vallow) && l.V > r.Vallow) ? 0xef4444
          : (l.V > 4.5 ? 0xf59e0b : 0x94a3b8);
        var wall = new THREE.Mesh(
          new THREE.CylinderGeometry(rr, rr, len, 28, 1, true, Math.PI * 0.32, Math.PI * 1.36),
          new THREE.MeshStandardMaterial({ color: wallCol, metalness: 0.72, roughness: 0.34, side: THREE.DoubleSide }));
        wall.position.set(mx, my, 0);
        wall.rotation.z = ang - Math.PI / 2;
        g.add(wall);

        // an elbow ball at each joint, so the route reads as connected
        var joint = new THREE.Mesh(new THREE.SphereGeometry(rr * 1.02, 14, 10),
          new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.3 }));
        joint.position.set(bx, by, 0); g.add(joint);

        /* This leg's own label, set clear of the pipe on the side away from
           the middle of the route. Hanging every label straight above its
           leg put the riser's label on top of the leg above it. */
        var px = -Math.sin(ang), py = Math.cos(ang);          // leg normal
        if ((mx * px + my * py) < 0) { px = -px; py = -py; }  // point outward
        var lbl = sprite('L' + l.idx + '  ' + l.nps + '"  ' + U(l.V, 'velocity', 2)
          + '  ' + U((l.dpPa || 0) / 1e5, 'press-drop', 4), '#cbd5e1');
        lbl.position.set(mx + px * (rr + 1.5), my + py * (rr + 1.5), 0);
        lbl.scale.multiplyScalar(0.72);
        g.add(lbl);

        /* The components the engineer placed on THIS leg, at the position
           they sit along it. They were counted into the hydraulics all
           along, but never drawn — so a route with a globe valve and a
           check valve looked like bare pipe, and there was no way to see on
           the model which leg carried what. */
        (l.items || []).forEach(function (it, itIdx) {
          var tpos = (isFinite(it.t) ? it.t : 0.5);
          var px2 = ax + dx * tpos, py2 = ay + dy * tpos;
          var col = new THREE.Color(it.colour || '#94a3b8');
          var mat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.75, roughness: 0.3 });
          var grp = new THREE.Group();
          grp.position.set(px2, py2, 0);
          grp.rotation.z = ang;
          if (it.sym === 'red' || it.key === 'red' || it.key === 'ered') {
            // a reducer is a cone between two bores
            var cone = new THREE.Mesh(new THREE.CylinderGeometry(rr * 1.05, rr * 0.7, rr * 1.6, 16), mat);
            cone.rotation.z = Math.PI / 2; grp.add(cone);
          } else if (/flange|spec|spade|ringspacer|orifice/.test(it.key)) {
            var disc = new THREE.Mesh(new THREE.CylinderGeometry(rr * 1.35, rr * 1.35, rr * 0.22, 20), mat);
            disc.rotation.z = Math.PI / 2; grp.add(disc);
          } else if (/strain/.test(it.key)) {
            var basket = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.75, rr * 1.15, rr * 1.8, 14), mat);
            basket.rotation.z = Math.PI / 3; basket.position.y = -rr * 0.7; grp.add(basket);
          } else if (/^e\d|^m\d/.test(it.key)) {
            var bend = new THREE.Mesh(new THREE.TorusGeometry(rr * 0.9, rr * 0.22, 8, 18, Math.PI / 2), mat);
            grp.add(bend);
          } else {
            // valve family: a body, a stem and a handwheel
            var body = new THREE.Mesh(new THREE.SphereGeometry(rr * 0.95, 14, 10), mat);
            body.scale.set(1.15, 1, 1); grp.add(body);
            var stem = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.13, rr * 0.13, rr * 1.5, 8), mat);
            stem.position.y = rr * 1.05; grp.add(stem);
            var wheel = new THREE.Mesh(new THREE.TorusGeometry(rr * 0.55, rr * 0.11, 7, 16), mat);
            wheel.position.y = rr * 1.8; wheel.rotation.x = Math.PI / 2; grp.add(wheel);
          }
          g.add(grp);
          // two components close together on one leg would print their tags
          // in the same place, so alternate which side of the pipe they go
          var side = (itIdx % 2) ? 1 : -1;
          var tg2 = sprite(it.tag || it.name || '', '#e2e8f0');
          tg2.position.set(px2 - Math.sin(ang) * side * (rr + 2.1),
                           py2 + Math.cos(ang) * side * (rr + 2.1), 0);
          tg2.scale.multiplyScalar(0.6); g.add(tg2);
        });

        /* Tracers carry the STREAM, not just a speed. How many there are
           follows the volumetric flow, how fast they move follows this
           leg's velocity, and what they look like follows what is actually
           flowing — a gas line is a thin fast mist, a liquid line a dense
           column, a slurry carries visible solids, and a two-phase line
           shows bubbles riding in liquid. */
        var sp = Math.max(0.02, Math.min(0.5, (l.V || 1) * 0.03));
        var ph = cfg.momPhase || 'liquid';
        var Q = isFinite(r.Q) ? r.Q : 50;                       // m³/h
        var dens = ph === 'gas' || ph === 'steam' ? 2.6 : ph === 'slurry' ? 1.5 : 1.9;
        var n = Math.max(3, Math.min(46, Math.round(len * dens * (0.6 + Math.min(1.6, Q / 90)))));
        var look = {
          liquid: { c: cfg.tracer || 0x93c5fd, r: 0.17, o: 0.95 },
          gas:    { c: 0xe2e8f0, r: 0.09, o: 0.55 },
          steam:  { c: 0xffffff, r: 0.11, o: 0.6 },
          slurry: { c: 0xd6bd8a, r: 0.2, o: 1.0 },
          twophase: { c: 0x93c5fd, r: 0.15, o: 0.85 }
        }[ph] || { c: 0xffffff, r: 0.16, o: 0.9 };
        var tm = new THREE.MeshBasicMaterial({ color: look.c, transparent: true,
          opacity: look.o, blending: THREE.AdditiveBlending, depthWrite: false });
        // slurry carries solids that are not additive — they are opaque grains
        var solidMat = ph === 'slurry'
          ? new THREE.MeshStandardMaterial({ color: 0x8a6b3f, metalness: 0.1, roughness: 0.95 }) : null;
        for (var q = 0; q < n; q++) {
          var isSolid = solidMat && (q % 3 === 0);
          var rad = rr * look.r * (0.7 + Math.random() * 0.7);
          var bead = new THREE.Mesh(new THREE.SphereGeometry(rad, 7, 6), isSolid ? solidMat : tm);
          g.add(bead);
          // grains lag the carrier slightly; gas wisps run a little ahead
          var vf = isSolid ? 0.82 : (ph === 'gas' || ph === 'steam' ? 1.0 + Math.random() * 0.25 : 0.9 + Math.random() * 0.2);
          var off = (Math.random() - 0.5) * rr * 1.1;
          parts.push({ m: bead, ax: ax - Math.sin(ang) * off, ay: ay + Math.cos(ang) * off,
            ux: dx / len, uy: dy / len, len: len, u: Math.random() * len, sp: sp * vf });
        }
      });

      // where the run starts and ends, with the pressure at each end
      var first = legs[0], last = legs[legs.length - 1];
      var sx = (first.x1 - cx) * k, sy = -(first.y1 - cy) * k;
      var ex = (last.x2 - cx) * k, ey = -(last.y2 - cy) * k;
      /* The station labels go OFF THE ENDS of the run, along the first and
         last legs' own direction. Hanging them above the end points put them
         on top of whichever leg label was nearest — the inlet marker landed
         on the riser's label every time the run started with a short leg. */
      var fa = Math.atan2(-(first.y2 - first.y1), (first.x2 - first.x1));
      var la = Math.atan2(-(last.y2 - last.y1), (last.x2 - last.x1));
      var p1 = sprite('P1  ' + U(pUp, 'press-drop', 3), '#f9a8d4');
      p1.position.set(sx - Math.cos(fa) * 3.0, sy - Math.sin(fa) * 3.0 + 0.9, 0);
      p1.scale.multiplyScalar(0.85); g.add(p1);
      var p2 = sprite('P2  ' + U(Math.max(0, pEnd), 'press-drop', 3), '#f9a8d4');
      p2.position.set(ex + Math.cos(la) * 2.0, ey + Math.sin(la) * 2.0 + 1.5, 0);
      p2.scale.multiplyScalar(0.85); g.add(p2);

      var arrow = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 14),
        new THREE.MeshBasicMaterial({ color: 0x22c55e }));
      arrow.position.set(ex + Math.cos(la) * 1.1, ey + Math.sin(la) * 1.1, 0);
      arrow.rotation.z = la - Math.PI / 2; g.add(arrow);

      three.anim = function () {
        for (var i = 0; i < parts.length; i++) {
          var q = parts[i];
          q.u += q.sp; if (q.u > q.len) q.u = 0;
          q.m.position.set(q.ax + q.ux * q.u, q.ay + q.uy * q.u, 0);
        }
      };

      renderBernoulli(r);
      var exA = $(id('3dext')); if (exA) { exA.textContent = ''; exA.style.display = 'none'; }
      var sc = $(id('3dscale'));
      if (sc) sc.innerHTML = flatR ? 'static pressure constant along the run'
        : U(Math.max(0, pEnd), 'press-drop', 3) + ' <u></u> ' + U(pUp, 'press-drop', 3)
          + '&nbsp;&nbsp;static pressure · ' + legs.length + ' legs as drawn';
      /* Where the extremes are, and on which leg. On a multi-leg route the
         worst velocity and the biggest drop are rarely on the same leg, and
         naming them is what turns the picture into something actionable. */
      var vMinL = legs[0], vMaxL = legs[0], dpMaxL = legs[0];
      legs.forEach(function (x) {
        if (x.V < vMinL.V) vMinL = x;
        if (x.V > vMaxL.V) vMaxL = x;
        if ((x.dpPa || 0) > (dpMaxL.dpPa || 0)) dpMaxL = x;
      });
      /* The extremes go in the caption rather than into the scene. As a 3D
         sprite they sat below the run and fell outside the frame whenever
         the route was wide, which is exactly when they matter most. */
      var extremes = 'MAX V  L' + vMaxL.idx + ' ' + U(vMaxL.V, 'velocity', 2)
        + '  ·  MIN V  L' + vMinL.idx + ' ' + U(vMinL.V, 'velocity', 2)
        + '  ·  WORST ΔP  L' + dpMaxL.idx + ' ' + U((dpMaxL.dpPa || 0) / 1e5, 'press-drop', 4)
        + '  ·  P MAX ' + U(pUp, 'press-drop', 3)
        + '  ·  P MIN ' + U(Math.max(0, pEnd), 'press-drop', 3);

      var tg = $(id('3dtag')), sb = $(id('3dsub'));
      if (tg) tg.textContent = (cfg.tag3d ? cfg.tag3d(r) : cfg.title).toUpperCase() + ' — AS DRAWN';
      if (sb) sb.textContent = legs.length + ' legs · ' + U(r.L, 'length-m', 1) + ' total · V '
        + U(vMinL.V, 'velocity', 2) + '–' + U(vMaxL.V, 'velocity', 2)
        + ' · ΔP ' + U(r.dpTotal, 'press-drop', 4)
        + ' · ' + legs.reduce(function (a, x) { return a + ((x.items || []).length); }, 0) + ' components';
      var ex = $(id('3dext'));
      if (ex) { ex.textContent = extremes; ex.style.display = 'block'; }
      three.sph.tx = 0; three.sph.ty = 0;
      if (!three.framed) { three.sph.r = 30; three.sph.theta = 0.0; three.sph.phi = 1.4; three.framed = true; }
      three.place(); resize3D();
    }

    /* The run is drawn at true proportion, the stream inside it animated at a
       speed set by the calculated velocity and coloured by how it sits
       against the velocity band. */
    function update3D(r) {
      if (!r) return;
      /* Deferred to first paint instead of built at boot() alongside every
         other stream — see the note in init3D()'s render loop for why
         creating a WebGL context nobody can see yet is worth avoiding. A
         hidden tab's calc() still runs (results stay ready the instant the
         tab is opened); only the 3D context waits for the panel to actually
         be on screen. */
      if (!three) {
        var host = document.getElementById(cfg.host);
        if (!host || !host.offsetParent) return;
        init3D();
      }
      if (!three) return;
      var g = three.group;
      three.anim = null;
      g.rotation.set(0, 0, 0);
      while (g.children.length) { var c = g.children.pop(); if (c.geometry) c.geometry.dispose(); }

      /* In manual mode the engineer has drawn a real route — legs of
         different length, bore and elevation, with components on them. A
         single averaged tube is the wrong picture of that, so when a route
         exists the view follows it leg by leg. */
      if (MODE === 'manual' && PIDSUM && PIDSUM.route && PIDSUM.route.length) {
        routeView(r, g);
        return;
      }

      var L = 22;
      var realLD = (r.L > 0 && r.D > 0) ? (r.L / r.D) : 40;
      var R = Math.max(0.45, Math.min(4.2, (L / 2) / Math.max(4, realLD / 2)));

      /* ── The line as a CUTAWAY, so the flow inside it is the subject ─────
         Earlier versions showed a solid metal tube with beads sliding along
         its outside. That tells you a pipe exists and roughly how fast
         something moves, but it hides the one thing an engineer wants to
         look at: what the fluid is doing inside the bore, and where along
         the run the pressure has gone.

         So the wall is cut away over the quadrant facing the camera — a real
         section, the way a cutaway drawing is made — and the bore is filled
         with a fluid core coloured along its length by the local static
         pressure. The colour ramp is the same one the key under the view
         shows: blue where the pressure has fallen furthest, red where it is
         highest. Friction, static head and fitting losses all bend that ramp
         because it is drawn from the computed pressure profile, not from a
         gradient chosen to look nice.

         The run is also tilted by its real slope, so a line that climbs
         looks like it climbs and its pressure ramp visibly steepens. */
      var slope = (isFinite(r.dz) && isFinite(r.L) && r.L > 0)
        ? Math.atan2(r.dz, r.L) : 0;
      /* A steep run drawn at its true angle walks straight out of the
         frame — 20 m of lift over a 10 m run is 63°. The slope is shown, but
         compressed, so a climbing line still reads as climbing. */
      slope = Math.max(-0.30, Math.min(0.30, slope * 0.5));
      g.rotation.z = slope;

      var pUp = isFinite(r.pUp) ? r.pUp : 0;
      var pDn = isFinite(r.pDown) ? r.pDown : pUp;
      /* Static pressure along the run. Friction and fitting losses accrue
         with distance; the static-head term follows the elevation, so a
         rising line loses pressure faster than friction alone explains. */
      function pAt(u) {                                    // u: 0 at inlet, 1 at outlet
        var fricPa = (r.dpFricPa || 0) + (r.dpFitPa || 0);
        var statPa = r.dpStatPa || 0;
        var pa = pUp * 1e5 - fricPa * u - statPa * u;
        return Math.max(0, pa / 1e5);
      }
      // a line that runs out of pressure would otherwise colour-key from a
      // negative bar figure, which is not a pressure that exists
      if (!(pDn >= 0)) pDn = 0;
      var pLo = Math.min(pUp, pDn), pHi = Math.max(pUp, pDn);
      /* The ramp is stretched across whatever the drop actually is, so the
         variation along the run is visible even when it is small — a 0.002
         bar drop on a gas line would otherwise paint one flat colour and
         show nothing. That makes the colour RELATIVE, so the key under the
         view is labelled with the two real end pressures rather than a bare
         "low / high", and cannot be read as an absolute scale. */
      var flat = (pHi - pLo) < 1e-9;
      var pSpan = Math.max(1e-9, pHi - pLo);

      /* A six-stop ramp, cold to hot, painted into a texture that runs along
         the bore. Sampling the real profile means the picture cannot drift
         away from the numbers underneath it. */
      var RAMP = [[37, 99, 235], [34, 211, 238], [34, 197, 94], [250, 204, 21], [249, 115, 22], [239, 68, 68]];
      function rampAt(f) {
        f = Math.max(0, Math.min(0.9999, f));
        var i = Math.floor(f * (RAMP.length - 1)), t2 = f * (RAMP.length - 1) - i;
        var a = RAMP[i], b2 = RAMP[Math.min(RAMP.length - 1, i + 1)];
        return [Math.round(a[0] + (b2[0] - a[0]) * t2),
                Math.round(a[1] + (b2[1] - a[1]) * t2),
                Math.round(a[2] + (b2[2] - a[2]) * t2)];
      }
      /* A cylinder maps its texture U around the circumference and V along
         the axis, so the ramp has to be drawn DOWN a tall canvas to run
         along the bore — drawn across a wide one it wraps around the pipe
         instead, which paints a rainbow ring and no gradient at all.
         The mesh is then rotated onto the X axis, which puts V = 1 at the
         inlet end, so the canvas is filled from the outlet upwards. */
      var gc = document.createElement('canvas');
      gc.width = 4; gc.height = 256;
      var gx = gc.getContext('2d');
      for (var py2 = 0; py2 < 256; py2++) {
        // canvas top lands at the inlet end once the mesh is turned onto X,
        // so row 0 carries u = 0 — the highest pressure, at the inlet
        var u2 = py2 / 255;
        var c2 = flat ? rampAt(0.82) : rampAt((pAt(u2) - pLo) / pSpan);
        gx.fillStyle = 'rgb(' + c2[0] + ',' + c2[1] + ',' + c2[2] + ')';
        gx.fillRect(0, py2, 4, 1);
      }
      var rampTex = new THREE.CanvasTexture(gc);
      rampTex.needsUpdate = true;

      // the fluid filling the bore
      var fluid = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.82, R * 0.82, L, 56, 1, false),
        new THREE.MeshStandardMaterial({
          map: rampTex, emissiveMap: rampTex, emissive: 0xffffff, emissiveIntensity: 0.55,
          metalness: 0.05, roughness: 0.55, transparent: true, opacity: 0.97
        }));
      fluid.rotation.z = Math.PI / 2;
      g.add(fluid);

      /* The wall, cut away over the near quadrant. DoubleSide so the inside
         face of the far wall is visible through the opening, which is what
         makes it read as a section rather than a broken tube. */
      var wallCol = !isFinite(r.V) ? 0x64748b : !r.eroOk ? 0xef4444 : !r.velOk ? 0xf59e0b : 0x94a3b8;
      var wall = new THREE.Mesh(
        new THREE.CylinderGeometry(R, R, L, 56, 1, true, Math.PI * 0.32, Math.PI * 1.36),
        new THREE.MeshStandardMaterial({ color: wallCol, metalness: 0.72, roughness: 0.34, side: THREE.DoubleSide }));
      wall.rotation.z = Math.PI / 2; g.add(wall);
      // the cut edge, so the wall reads as having thickness
      [-1, 1].forEach(function (s2) {
        var lip = new THREE.Mesh(new THREE.TorusGeometry(R * 0.95, R * 0.055, 8, 40),
          new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.3 }));
        lip.rotation.y = Math.PI / 2; lip.position.x = s2 * L / 2 * 0.999; g.add(lip);
      });

      var boreMat = new THREE.MeshStandardMaterial({ color: 0x05070c, metalness: 0.1, roughness: 0.9 });
      [-L / 2, L / 2].forEach(function (px) {
        var fl = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.25, R * 1.25, 0.35, 32), new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.35 }));
        fl.rotation.z = Math.PI / 2; fl.position.x = px; g.add(fl);
        var cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.24, R * 1.24, R * 0.1, 24), boreMat);
        cap.rotation.z = Math.PI / 2; cap.position.x = px - Math.sign(px) * R * 0.2; g.add(cap);
      });

      /* Tracers now ride INSIDE the bore, at the radius they would actually
         occupy, and each moves at the local velocity rather than all at one
         speed. A turbulent line runs nearly flat across the bore with a thin
         slow film at the wall; a laminar one is a clear parabola. Watching
         the middle outrun the edge is the profile, drawn rather than
         described. */
      var parts = [], vScale = Math.max(0.03, Math.min(0.6, (r.V || 1) * 0.032));
      var lam = (r.Re || 1e5) < 2100;
      var tracerMat = new THREE.MeshBasicMaterial({
        color: cfg.tracer || 0xffffff, transparent: true, opacity: 0.92,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      var nTracers = 46;
      for (var i = 0; i < nTracers; i++) {
        var ang = Math.random() * Math.PI * 2;
        var rr = Math.sqrt(Math.random()) * R * 0.74;       // even area coverage
        var u = rr / (R * 0.82);                            // 0 centre → 1 wall
        // laminar: 1 − u² ; turbulent: the 1/7-power profile
        var vRel = lam ? Math.max(0.05, 1 - u * u) : Math.pow(Math.max(0.02, 1 - u), 1 / 7);
        var s = new THREE.Mesh(new THREE.SphereGeometry(R * 0.055 + Math.random() * R * 0.035, 8, 6), tracerMat);
        s.position.set(-L / 2 + Math.random() * L, Math.sin(ang) * rr, Math.cos(ang) * rr);
        g.add(s);
        parts.push({ m: s, sp: vScale * vRel });
      }

      var ar = new THREE.Mesh(new THREE.ConeGeometry(Math.max(0.25, R * 0.55), Math.max(0.8, R * 1.6), 14), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
      ar.rotation.z = -Math.PI / 2; ar.position.set(L / 2 + R * 2.2, 0, 0); g.add(ar);

      /* Station markers, so the gauges under the view have somewhere on the
         model to point at. */
      [['P1', -L / 2 + L * 0.06, 0xf472b6], ['P2', L / 2 - L * 0.06, 0xf472b6]].forEach(function (st) {
        var ringM = new THREE.MeshBasicMaterial({ color: st[2] });
        var ring = new THREE.Mesh(new THREE.TorusGeometry(R * 1.3, R * 0.045, 6, 32), ringM);
        ring.rotation.y = Math.PI / 2; ring.position.x = st[1]; g.add(ring);
        var stalk = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.03, R * 0.03, R * 1.5, 6), ringM);
        stalk.position.set(st[1], R * 1.3 + R * 0.75, 0); g.add(stalk);
        var lbl = sprite(st[0], '#f9a8d4');
        lbl.position.set(st[1], R * 1.3 + R * 1.9, 0); g.add(lbl);
      });

      var from = (t('from', '') || 'FROM').toUpperCase(), to = (t('to', '') || 'TO').toUpperCase();
      var a = sprite(from, '#38bdf8'); a.position.set(-L / 2 - 2.4, R + 1.9, 0); g.add(a);
      var b = sprite('→ ' + to, '#22c55e'); b.position.set(L / 2 + 2.4, R + 1.9, 0); g.add(b);
      var sz = sprite(r.nps + '" SCH ' + r.sch + '  ·  ID ' + U(r.Dmm, 'length-mm', 1) + '  ·  ' + U(r.L, 'length-m', 1), '#94a3b8');
      sz.position.set(0, -R - 1.9, 0); g.add(sz);

      three.anim = function () {
        for (var i = 0; i < parts.length; i++) {
          parts[i].m.position.x += parts[i].sp;
          if (parts[i].m.position.x > L / 2) parts[i].m.position.x = -L / 2;
        }
      };
      renderBernoulli(r);
      var exA = $(id('3dext')); if (exA) { exA.textContent = ''; exA.style.display = 'none'; }
      var sc = $(id('3dscale'));
      if (sc) sc.innerHTML = flat
        ? 'static pressure constant along the run'
        : U(pLo, 'press-drop', 3) + ' <u></u> ' + U(pHi, 'press-drop', 3) + '&nbsp;&nbsp;static pressure';
      var tag = $(id('3dtag')), sub = $(id('3dsub'));
      if (tag) tag.textContent = (cfg.tag3d ? cfg.tag3d(r) : cfg.title).toUpperCase();
      if (sub) sub.textContent = (cfg.sub3d ? cfg.sub3d(r) + '  ·  ' : '') + 'V ' + U(r.V, 'velocity', 2) + ' · ' + r.nps + '" Sch ' + r.sch + ' · ΔP ' + f4(r.dpTotal) + ' bar';
      three.sph.tx = 0; three.sph.ty = 0;
      if (!three.framed) { three.sph.r = 21; three.sph.theta = 0.35; three.sph.phi = 1.30; three.framed = true; }
      three.place(); resize3D();
    }

    /* ── report ── */
    function report() {
      var r = LAST || compute();
      var sec = function (x) { return '<div style="font-size:13px;font-weight:800;color:#ea580c;border-bottom:2px solid #ea580c;padding-bottom:3px;margin:16px 0 8px;">' + x + '</div>'; };
      var T = function (rows) {
        return '<table style="width:100%;border-collapse:collapse;font-size:11.5px;table-layout:fixed;word-break:break-word;">' + rows.map(function (x) {
          return '<tr><td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#475569;width:54%;">' + x[0] + '</td>'
            + '<td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:700;">' + x[1] + '</td></tr>';
        }).join('') + '</table>';
      };
      var b = '<div style="font-family:Arial,sans-serif;color:#0f172a;">'
        + '<h2 style="text-align:center;color:#ea580c;margin:0;">AROGARA FLOWSIZE — ' + esc(cfg.title) + ' REPORT</h2>'
        + '<div style="text-align:center;font-size:10px;color:#64748b;">AROGARA FLOWSIZE · Digital Engineering Design Platform</div>'
        + sec('1 · DESIGN DATA SHEET')
        + T([['Company', esc(t('company', '—'))], ['Project location', esc(t('loc', '—'))],
             ['Line tag no.', esc(t('lineno', '—'))], ['Service description', esc(t('svcdesc', '—'))],
             ['P&ID No.', esc(t('pid', '—'))],
             ['From → To', esc(t('from', '—')) + ' → ' + esc(t('to', '—'))],
             ['Engineer', esc(t('engineer', '—'))], ['Revision', esc(t('dsrev', '—'))],
             ['Data sheet date', esc(t('dsdate', '')) || new Date().toISOString().slice(0, 10)],
             ['Report date', new Date().toISOString().slice(0, 10)]]);

      b += sec('2 · PHYSICAL PROPERTIES') + T(cfg.reportProps(r, R));

      /* In MANUAL the drawing is the design record, so both views go in. */
      if (MODE === 'manual' && window.AROPID) {
        var i2 = null, i3 = null;
        try { i2 = window.AROPID.image2D(); } catch (e) {}
        try { i3 = window.AROPID.image3D(); } catch (e) {}
        if (i2 || i3) {
          b += sec('2A · P&amp;ID SCHEMATIC AND 3D MODEL');
          if (i2) b += '<div style="text-align:center;margin:8px 0;"><img src="' + i2 + '" style="max-width:100%;border:1px solid #cbd5e1;border-radius:4px;"/>'
            + '<div style="font-size:9.5px;color:#64748b;margin-top:3px;">2D P&amp;ID as drawn — leg lengths, sizes, tags and components</div></div>';
          if (i3) b += '<div style="text-align:center;margin:10px 0;"><img src="' + i3 + '" style="max-width:100%;border:1px solid #cbd5e1;border-radius:4px;"/>'
            + '<div style="font-size:9.5px;color:#64748b;margin-top:3px;">3D model of the same route — bore, run length and components follow the sketch</div></div>';
          var sm = null; try { sm = window.AROPID.summary(); } catch (e) {}
          if (sm) b += T([['Legs drawn', String(sm.legs)], ['Developed length', U(sm.L, 'length-m', 2)],
                          ['Rise / fall', CV(sm.rise, 'length-m').toFixed(2) + ' / ' + U(sm.drop, 'length-m', 2)],
                          ['Net static height Δz', U(sm.dz, 'length-m', 2)],
                          ['Components placed', String(sm.items) + (sm.auto ? ' + ' + sm.auto + ' assumed elbows' : '')]]);
        }
      }

      b += sec('3 · PIPE DATA')
        + T([['NPS / schedule', r.nps + '" Sch ' + r.sch], ['Outside diameter', f3(r.odIn) + ' in  (' + U(r.odIn * 25.4, 'length-mm', 2) + ')'],
             ['Inside diameter', f3(r.idIn) + ' in  (' + U(r.Dmm, 'length-mm', 2) + ')'], ['Wall thickness', f3(r.thkIn) + ' in'],
             ['Material', esc(r.matName)], ['Absolute roughness ε', U(r.eps, 'length-mm', 4)],
             ['Relative roughness ε/D', isFinite(r.relRough) ? r.relRough.toExponential(3) : '—'],
             ['Line length', U(r.L, 'length-m', 2) + (MODE === 'manual' ? '  (from the P&ID)' : '')],
             ['Static height Δz', U(r.dz, 'length-m', 2) + (MODE === 'manual' ? '  (from the P&ID)' : '')]]);

      b += sec('4 · FLOW AND VELOCITY')
        + T([['Design volumetric flow', U(r.Q, 'vol-flow', 3)], ['Mass flow', U(r.W, 'mass-flow', 1)],
             ['Line velocity', U(r.V, 'velocity', 3)], ['Service', esc(r.svc)],
             ['Velocity band', UB(r.vMin, r.vMax, 'velocity', 2)],
             ['Minimum range met', r.velMinOk ? 'YES' : 'NO'], ['Maximum range met', r.velMaxOk ? 'YES' : 'NO'],
             ['Size verdict', r.sizeAdvice],
             ['Reynolds number', f0(r.Re)], ['Flow behaviour', r.flow], ['Friction factor f', f4(r.f)]]
            .concat(cfg.reportFlow ? cfg.reportFlow(r, R) : []));

      b += sec('5 · ' + (cfg.eroTitle || 'EROSIONAL VELOCITY (API RP 14E)'))
        + T((cfg.eroReport ? cfg.eroReport(r, R)
              : [['Service / C factor', esc(t('cservice', '—')) + '  ·  C = ' + f0(r.C)],
                 ['Density', f3(r.rhoLb) + ' lb/ft³'],
                 ['Erosional velocity', U(r.Ve, 'velocity', 3)]]
                .concat(cfg.noPct ? [] : [['Design set point', f0(r.pct) + ' %']])
                .concat([['Allowable velocity', U(r.Vallow, 'velocity', 3)]]))
            .concat([['Actual < allowable', r.eroOk ? 'YES' : 'NO']]));

      /* Momentum flux belongs in the issued document, not only on screen —
         it is one of the figures a reviewer checks the line against. Written
         with its basis and its limit (or the absence of one) so the number
         cannot be read as a verdict it was never given. */
      if (r.mom) {
        b += sec('5A · MOMENTUM FLUX & DYNAMIC PRESSURE')
          + T([['Flow type', esc(r.mom.flowType || '—')],
               ['Flowing density', f2(r.mom.density) + ' kg/m³'],
               ['Actual velocity (on true ID)', U(r.mom.velocity, 'velocity', 3)],
               ['Momentum flux  J = ρV²', f2(r.mom.momentumFluxKPa) + ' kPa  (' + f0(r.mom.momentumFluxPa) + ' Pa)'],
               ['Dynamic pressure  q = ½ρV²', f2(r.mom.dynamicPressureKPa) + ' kPa  (' + f0(r.mom.dynamicPressurePa) + ' Pa)'],
               ['Allowable momentum limit', r.mom.criterion.configured
                 ? f2(r.mom.momentumFluxPa / (r.mom.criterion.utilizationPercent / 100) / 1000) + ' kPa' : 'Not configured'],
               ['Utilisation', r.mom.criterion.configured ? f1(r.mom.criterion.utilizationPercent) + ' %' : '—'],
               ['Momentum status', r.mom.criterion.status],
               ['Velocity utilisation vs allowable', isFinite(r.mom.velocityUtilizationPercent)
                 ? f1(r.mom.velocityUtilizationPercent) + ' %' : '—'],
               ['Erosion screening', r.mom.erosionStatus],
               ['Governing criteria for this service', esc(r.mom.priority.primary)
                 + ' — momentum is ' + esc(r.mom.priority.momentum)],
               ['Basis', esc(r.mom.basis)],
               ['Screening assumptions', esc(r.mom.erosion.assumptions)]]);
      }

      b += sec('6 · PRESSURE DROP')
        + T([['Darcy–Weisbach friction', U(r.dpFricPa / 1e5, 'press-drop', 4)],
             ['Head loss', U(r.headLoss, 'length-m', 3)],
             ['Static head', U(r.dpStatPa / 1e5, 'press-drop', 4)],
             ['Equipment / vendor', U(r.dpEq, 'press-drop', 4)],
             ['Fittings ΣK', f2(r.sumK)],
             ['Fittings loss', U(r.dpFitPa / 1e5, 'press-drop', 4)],
             ['Total pressure drop', U(r.dpTotal, 'press-drop', 4)],
             ['Allowable ΔP', isFinite(r.dpAllow) ? U(r.dpAllow, 'press-drop', 3) : 'not specified'],
             ['Upstream pressure', UG(r.pUp, 'pressure', 3, '(G)')], ['Downstream pressure', UG(r.pDown, 'pressure', 3, '(G)') + (r.pDownOk ? '' : ' — NO PRESSURE LEFT TO DELIVER')],
             ['Within allowance', isFinite(r.dpAllow) ? (r.dpOk ? 'YES' : 'NO') : '—']]);

      if (r.fitList.length) {
        b += sec('7 · FITTING SCHEDULE')
          + '<table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed;word-break:break-word;"><tr style="background:#f1f5f9;">'
          + '<th style="padding:5px;text-align:left;">Item</th><th style="padding:5px;text-align:right;">Qty</th>'
          + '<th style="padding:5px;text-align:right;">K each</th><th style="padding:5px;text-align:right;">ΣK</th></tr>'
          + r.fitList.map(function (x) {
              return '<tr><td style="padding:5px;border-bottom:1px solid #e2e8f0;">' + esc(x.name) + '</td>'
                + '<td style="padding:5px;border-bottom:1px solid #e2e8f0;text-align:right;">' + x.qty + '</td>'
                + '<td style="padding:5px;border-bottom:1px solid #e2e8f0;text-align:right;">' + x.k + '</td>'
                + '<td style="padding:5px;border-bottom:1px solid #e2e8f0;text-align:right;">' + f2(x.total) + '</td></tr>';
            }).join('')
          + '<tr><td style="padding:5px;font-weight:700;">Total ΣK</td><td></td><td></td><td style="padding:5px;text-align:right;font-weight:700;">' + f2(r.sumK) + '</td></tr></table>';
      }

      b += sec('8 · VERDICT');
      checks(r).forEach(function (c) {
        b += '<div style="margin:5px 0;padding:6px 8px;border-left:3px solid ' + (c.ok ? '#16a34a' : '#ea580c') + ';background:' + (c.ok ? '#f0fdf4' : '#fff7ed') + ';">'
          + '<b style="font-size:11px;">' + esc(c.label) + ' — ' + (c.ok ? 'PASS' : 'REVIEW') + '</b>'
          + '<div style="font-size:10.5px;color:#334155;margin-top:2px;">' + esc(c.detail) + '</div></div>';
      });
      var sg = suggestions(r);
      if (sg.length) {
        b += sec('9 · RECOMMENDATIONS');
        sg.forEach(function (s) {
          b += '<div style="margin:6px 0;padding:6px 8px;border-left:3px solid #ea580c;background:#fff7ed;">'
            + '<b style="font-size:11px;">' + esc(s.title) + '</b>'
            + '<div style="font-size:10.5px;color:#334155;margin-top:2px;line-height:1.5;">' + esc(s.why) + '</div></div>';
        });
      }
      b += '<div style="margin-top:14px;font-size:9px;color:#64748b;">' + esc(cfg.basis) + ' Darcy–Weisbach friction with the Colebrook factor, Crane TP-410 K values banded by NPS, ASME B36.10M bores and API RP 14E erosional velocity. Confirm against the issued datasheet before construction.</div>';
      b += '</div>';
      modal(esc(cfg.title) + ' REPORT', b);
    }

    function modal(title, inner) {
      var old = $(id('modal')); if (old) old.remove();
      var m = document.createElement('div'); m.id = id('modal');
      m.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(2,6,18,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
      m.innerHTML = '<div style="background:#0f172a;border:1px solid #334155;border-radius:10px;max-width:1000px;width:100%;max-height:92vh;display:flex;flex-direction:column;">'
        + '<div style="display:flex;align-items:center;padding:12px 18px;border-bottom:1px solid #334155;">'
        + '<span style="font-family:monospace;font-size:13px;font-weight:800;color:#ff7538;flex:1;">' + title + '</span>'
        + '<button id="' + id('pdf') + '" style="margin-right:8px;background:#16a34a;border:none;color:#fff;font-family:monospace;font-size:11px;font-weight:700;padding:6px 12px;border-radius:4px;cursor:pointer;">⬇ PDF</button>'
        + '<button id="' + id('mclose') + '" style="background:#ef4444;border:none;color:#fff;font-family:monospace;font-size:11px;font-weight:700;padding:6px 12px;border-radius:4px;cursor:pointer;">✕ CLOSE</button></div>'
        + '<div id="' + id('mbody') + '" style="overflow:auto;padding:18px;background:#fff;border-radius:0 0 10px 10px;">' + inner + '</div></div>';
      document.body.appendChild(m);
      $(id('mclose')).onclick = function () { m.remove(); };
      m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
      var pb = $(id('pdf'));
      pb.onclick = function () {
        pb.textContent = '⏳ GENERATING…'; pb.disabled = true;
        var done = function () { pb.textContent = '⬇ PDF'; pb.disabled = false; };
        if (!window.AROPDF) { try { window.print(); } catch (e) {} done(); return; }
        var p = window.AROPDF($(id('mbody')), cfg.file + '.pdf', { landscape: false });
        if (p && p.then) p.then(done, done); else setTimeout(done, 1600);
      };
    }

    /* ── AUTO / MANUAL ── */
    function modeBar() {
      return '<div style="display:flex;align-items:center;gap:10px;margin:0 0 10px;">'
        + '<span style="font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:0.06em;">DESIGN MODE</span>'
        + '<select id="' + id('mode') + '" style="min-width:320px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:6px 8px;border-radius:3px;">'
        + '<option value="auto">AUTO — enter the inputs, the engine sizes the line</option>'
        + '<option value="manual">MANUAL — draw the line on the P&amp;ID workbench</option>'
        + '</select></div>';
    }
    function pidCfg() {
      return {
        nps: function () { return parseFloat(t('nps', String(cfg.dNps || 2))); },
        sch: function () { return t('sch', cfg.dSch || '40'); },
        mat: function () { return t('mat', 'CS'); },
        rho: function () { var p = cfg.props(g, t) || {}; return p.rho; },
        mu: function () { var p = cfg.props(g, t) || {}; return p.mu; },
        W: function () { var p = cfg.props(g, t) || {}; return p.W; },
        pup: function () { return g('pup', cfg.dPup || 6); },
        C: function () { return cfg.cfactor ? cfg.cfactor(t, g) : 100; },
        /* The allowable velocity this panel actually applied, so the
           drawing judges erosion by the same number the panel does. */
        vallow: function () {
          var rr = LAST || null;
          return rr && isFinite(rr.Vallow) ? rr.Vallow : NaN;
        },
        from: function () { return t('from', ''); },
        to: function () { return t('to', ''); },
        sizeIds: [id('nps'), id('sch')]
      };
    }
    function setMode(m) {
      MODE = m;
      var d3 = $(id('3dblock')), pid = $(id('pidblock'));
      if (!d3 || !pid) return;
      /* Manual mode used to REPLACE the flow view with the P&ID workbench,
         so the moment an engineer started drawing the line they lost the
         picture of what the fluid was doing in it — and the pressure ramp
         and the two station gauges went with it. Both belong on screen:
         the P&ID is where the line is drawn, the flow view is what that
         drawing produces. The workbench takes the top slot in manual mode
         and the flow view follows underneath it. */
      d3.style.display = 'block';
      pid.style.display = m === 'manual' ? 'block' : 'none';
      var host = d3.parentNode;
      if (host) {
        if (m === 'manual') host.insertBefore(pid, d3);      // P&ID first, flow below
        else host.insertBefore(d3, pid);                      // flow view alone on top
      }
      if (m === 'manual') {
        if (window.AROPID) {
          window.AROPID.build(id('pidblock'), pidCfg());
          window.AROPID.onChange(function (sum) { PIDSUM = sum; applyPid(sum); });
        }
        lockFittings(true);
        setTimeout(function () { resize3D(); }, 80);
      } else {
        PIDSUM = null; lockFittings(false);
        setTimeout(function () { resize3D(); calc(); }, 60);
      }
      calc();
    }
    function lockFittings(on) {
      var hd = $(id('fithdr'));
      if (hd) hd.innerHTML = hdr(on ? '6 · FITTINGS &amp; VALVES — COUNTED FROM THE P&amp;ID' : '6 · FITTINGS &amp; VALVES (quantity)');
      var note = $(id('fitnote'));
      if (note) {
        note.style.display = on ? 'block' : 'none';
        note.textContent = 'Counted live from the drawing. Draw the run and drop components on it — the quantities, line length and static height update as you go.';
      }
      FIT_NAMES.forEach(function (n, i) {
        var e = $(id('fit-' + i)); if (!e) return;
        e.readOnly = on;
        e.style.background = on ? 'rgba(56,189,248,0.08)' : 'rgba(2,6,18,0.6)';
        e.style.borderColor = on ? '#38bdf8' : 'var(--border-muted)';
        e.style.color = on ? '#7dd3fc' : '#e2e8f0';
        if (on) e.value = 0;
      });
      ['len', 'dz'].forEach(function (n) {
        var e = $(id(n)); if (!e) return;
        e.readOnly = on;
        e.style.background = on ? 'rgba(56,189,248,0.08)' : 'rgba(2,6,18,0.6)';
        e.style.borderColor = on ? '#38bdf8' : 'var(--border-muted)';
        e.style.color = on ? '#7dd3fc' : '#e2e8f0';
      });
    }
    function applyPid(sum) {
      if (MODE !== 'manual' || !sum) return;
      sum.counts.forEach(function (n, i) { var e = $(id('fit-' + i)); if (e) e.value = n; });
      if (sum.legs) {
        var L = $(id('len')), dz = $(id('dz'));
        if (L) L.value = sum.L.toFixed(2);
        if (dz) dz.value = sum.dz.toFixed(2);
      }
      /* Drawing a leg recalculates the line, and the first recalculation
         takes the module to CALCULATED — which asks the suite to scroll the
         results into view. That is right after RUN and wrong here: it drags
         the workbench the engineer is drawing on more than two thousand
         pixels off the top of the panel, mid-line. The next click lands on
         whatever has moved under the cursor, the run cannot be continued,
         and the input boxes are no longer where they were — which is what
         "it stops responding after I draw the diagram" looks like from the
         engineer's seat.

         A recalculation caused by the drawing is not a request to be shown
         the results. Flagged the way the suite already marks a run nobody
         asked for, and cleared past the 60 ms the reveal is scheduled at. */
      quietly(calc);
    }
    /* Run something that recalculates and republishes WITHOUT it counting as
       a run the engineer asked to be shown. The suite reveals the results the
       first time a module reaches CALCULATED, and that reveal is scheduled a
       beat after the publish, so the flag has to outlive the call. */
    function quietly(fn) {
      var was = window.__aroBackgroundRun;
      window.__aroBackgroundRun = true;
      try { return fn(); }
      finally { setTimeout(function () { window.__aroBackgroundRun = was || false; }, 300); }
    }

    /* ── undo / redo / reset ── */
    var IDS = ['company', 'loc', 'pid', 'lineno', 'from', 'to', 'svcdesc', 'engineer', 'dsdate', 'dsrev', 'nps', 'sch', 'mat', 'eps', 'kmat',
               'len', 'dz', 'dpeq', 'pcterosion', 'pup', 'svc', 'cservice'].concat(cfg.ids || []);
    FIT_NAMES.forEach(function (n, i) { IDS.push('fit-' + i); });
    function snapshot() { var s = {}; IDS.forEach(function (n) { var e = $(id(n)); if (e) s[n] = e.value; }); return s; }
    function restore(s) { if (!s) return; IDS.forEach(function (n) { var e = $(id(n)); if (e && s[n] !== undefined) e.value = s[n]; }); syncMat(); calc(); }
    function pushUndo() { if (lastSnap) UNDO.push(lastSnap); if (UNDO.length > 60) UNDO.shift(); REDO = []; lastSnap = snapshot(); }
    function blankAll() {
      IDS.forEach(function (n) { var e = $(id(n)); if (!e) return; if (e.tagName === 'SELECT') e.selectedIndex = 0; else e.value = ''; });
      if (window.AROPID && window.AROPID.reset) window.AROPID.reset();
      PIDSUM = null;
      ['run', 'status'].forEach(function (n) { var e = $(id(n)); if (e) { e.style.display = 'none'; e.textContent = ''; } });
      var a = $(id('advisor')); if (a) a.innerHTML = '';
      var rz = $(id('results')); if (rz) rz.innerHTML = '';
      if (window.ARORESET) {
        window.ARORESET.wipe(P, [id('advisor'), id('results'), id('run'), id('status'), id('fitchips')]);
        window.ARORESET.watch(P, cfg.host);
      }
      LAST = null;
      syncMat(); calc();
      /* A reset cleared the boxes and the results panel and told nothing else.
         The calculation state stayed CALCULATED, so the header still read
         RESULT CURRENT, and the 3D panel kept the spool it had built — an
         engineer who pressed RESET was left looking at NPS 4″ SCH 40 and
         4.061 m/s for a line that no longer had a flow rate.

         Note the id. P is this service's field prefix ('lq'); the state
         machine and the 3D panel know it as 'line-liquid'. Passing P to
         either is a call that silently does nothing, which is how the first
         attempt at this fix appeared to work and changed nothing at all.

         Told after calc(), because calc() republishes. */
      var MODID = String(cfg.host || '').replace(/-content$/, '');
      try { if (window.AROSTATE && window.AROSTATE.reset) window.AROSTATE.reset(MODID); } catch (e) {}
      try { if (window.ARO3DI && window.ARO3DI.clear) window.ARO3DI.clear(MODID); } catch (e) {}
    }
    function updHist() {
      var u = $(id('undo')), rd = $(id('redo'));
      if (u) { u.disabled = !UNDO.length; u.style.opacity = UNDO.length ? '1' : '0.4'; }
      if (rd) { rd.disabled = !REDO.length; rd.style.opacity = REDO.length ? '1' : '0.4'; }
    }

    /* "User defined" material exposes ε (and K where the stream needs it). */
    function syncMat() {
      var box = $(id('matuser')); if (!box) return;
      var m = MAT[t('mat', 'CS')];
      box.style.display = (!m || m[0] == null) ? 'block' : 'none';
    }

    function wire() {
      IDS.forEach(function (n) {
        var e = $(id(n)); if (!e) return;
        e.addEventListener('input', function () { pushUndo(); calc(); updHist(); });
        e.addEventListener('change', function () { pushUndo(); syncMat(); calc(); updHist(); });
      });
      var af = $(id('autofix'));
      if (af) af.addEventListener('change', function () { pushUndo(); calc(); updHist(); });
      if (cfg.wire) cfg.wire(H, function () { calc(); }, g, t);
      var md = $(id('mode')); if (md) md.addEventListener('change', function () { setMode(md.value); });
      var cb = $(id('calc'));
      if (cb) cb.addEventListener('click', function () {
        var missing = validateLineInputs();
        if (missing.length > 0) {
          showLineInputsDialog(missing);
          return;
        }
        if (window.ARORESET) window.ARORESET.lift(P);
        calc(); status();
        /* Confirm on the button that was pressed, the way the pump panel
           does. Without it the results simply changed somewhere below and
           nothing acknowledged the click. */
        if (typeof window.showCalcFeedback === 'function') window.showCalcFeedback(cb);
        var target = $(id('run'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      var rb = $(id('report')); if (rb) rb.addEventListener('click', report);
      var ub = $(id('undo')); if (ub) ub.addEventListener('click', function () { if (!UNDO.length) return; REDO.push(snapshot()); restore(UNDO.pop()); lastSnap = snapshot(); updHist(); });
      var rdb = $(id('redo')); if (rdb) rdb.addEventListener('click', function () { if (!REDO.length) return; UNDO.push(snapshot()); restore(REDO.pop()); lastSnap = snapshot(); updHist(); });
      var rs = $(id('reset')); if (rs) rs.addEventListener('click', function () { pushUndo(); blankAll(); updHist(); });
      lastSnap = snapshot(); if (!DEFAULTS) DEFAULTS = snapshot();
      updHist(); syncMat();
    }

    function build() {
      if (built) return;
      var host = document.getElementById(cfg.host); if (!host) return;
      host.innerHTML = modeBar() + panelHTML();
      built = true;
      wire();
      setTimeout(function () { resize3D(); calc(); }, 80);
      var tab = document.querySelector('[data-line-type="' + cfg.tab + '"]');
      if (tab) tab.addEventListener('click', function () { setTimeout(function () { resize3D(); calc(); }, 120); });
      /* The boot-time calc() above and the sub-tab click above both cover
         "this stream's own tab was clicked" — neither fires when this panel
         is Liquid's default-open stream and the surrounding LINE SIZING
         section itself is what just became visible (its own top-level tab
         switched, or the app just launched into it). The 3D never got a
         moment where it was both called AND visible, so it never lazily
         initialised at all. A ResizeObserver catches every route to
         visibility at once — the host panel goes from 0×0 under
         display:none to its real size the instant anything reveals it. */
      if (typeof ResizeObserver !== 'undefined') {
        var seenVisible = false;
        var ro = new ResizeObserver(function () {
          if (seenVisible || !host.offsetParent || !host.clientWidth) return;
          seenVisible = true; ro.disconnect(); calc();
        });
        ro.observe(host);
      }
    }

    return { build: build, calc: calc, compute: compute, report: report,
             mode: function () { return MODE; }, setMode: setMode };
  }

  /* ═══════════ LIQUID ═══════════ */
  var LIQ = make({
    key: 'lq', host: 'line-liquid-content', tab: 'liquid',
    momPhase: 'liquid',
    title: 'SINGLE-PHASE LIQUID LINE SIZING', runLabel: 'LIQUID LINE SIZING', file: 'Liquid_Line_Sizing_Report',
    dNps: 4, dSch: '40', dLen: 4, dDz: 0.5, dPup: 6, dPct: 75, tracer: 0x93c5fd,
    basis: 'Fluid properties from the project liquid library.',
    ids: ['fluid', 'rho', 'mu', 'q', 'tnorm', 'vmin', 'vmax', 'dpallow', 'cval', 'momlimit'],
    required: [
      { n: 'q', label: 'Design volumetric flow' },
      { n: 'tnorm', label: 'Operating temperature' },
      { n: 'pup', label: 'Upstream pressure' },
      { n: 'rho', label: 'Density' },
      { n: 'mu', label: 'Viscosity' }
    ],
    manualNoun: 'A LIQUID LINE',
    manualLead: 'A single-phase liquid line is sized on three checks together: velocity sits inside a band set by the '
      + 'service, the line stays below its API RP 14E erosional velocity, and the pressure drop stays inside whatever '
      + 'is allowed.',
    manualProps: '<ol class="aro-doc-ol">'
      + '<li><b>Fluid</b> &mdash; pick from the library. Density and viscosity are filled in for you, converted into '
      + 'whichever unit system is active. Selecting <i>User defined</i> leaves both blank.</li>'
      + '<li><b>Density</b> and <b>Viscosity</b> &mdash; overwrite the filled values whenever a datasheet or lab figure '
      + 'differs from the library entry.</li>'
      + '<li><b>Design volumetric flow</b> &mdash; the duty the line is sized for.</li></ol>',
    manualService: '<ol class="aro-doc-ol">'
      + '<li><b>Operating temperature</b> and <b>Upstream pressure</b> &mdash; the pressure carries into the '
      + 'downstream-pressure check described below.</li>'
      + '<li><b>Service Fluid Condition</b> &mdash; sets the velocity band and the allowable &Delta;P per 100 m from the '
      + 'workbook table (pump suction, pump discharge, gravity lines, boiler feed water, drains, general service). '
      + '<i>User defined</i> opens Min/Max velocity and an allowable &Delta;P for you to type directly.</li></ol>',
    manualErosion: '<p>Erosion follows API RP 14E: <b>Ve = C/&radic;&rho;</b>, with &rho; in lb/ft&sup3; and Ve in ft/s. '
      + 'Pick the <b>Service (C factor)</b> band &mdash; clean fluids, continuous or intermittent service, corrosion-'
      + 'resistant alloys, corrosive fluids &mdash; or enter your own C value. <b>% of erosional velocity</b> sets how '
      + 'close to Ve the design is allowed to run; 75&ndash;100&nbsp;% is the normal range for a clean, non-corrosive '
      + 'service, and the design assistant will point this out if a low set point is the only thing failing the line.</p>',
    manualChecks: '<li><b>Line velocity</b> &mdash; against the band set by the Service Fluid Condition.</li>'
      + '<li><b>Erosional velocity</b> &mdash; against the API RP 14E allowable computed above.</li>'
      + '<li><b>Pressure drop</b> &mdash; against the allowable &Delta;P per 100 m for the service (when the service '
      + 'states one; <i>User defined</i> leaves this check informational only).</li>',
    inputs: function (H) {
      var h = H.hdr('2 · PHYSICAL PROPERTIES');
      h += H.sel('FLUID', 'fluid', Object.keys(LIQUIDS), 'Water');
      h += H.two(H.fld('Density', 'rho', 'kg/m³', 997, '0.1'), H.fld('Viscosity', 'mu', 'cP', 1, '0.001'));
      h += H.fld('Design volumetric flow', 'q', 'm³/hr', '', '0.1');
      h += H.hdr('3 · OPERATING CONDITIONS');
      h += H.two(H.fld('Operating temperature', 'tnorm', '°C', '', '1'), H.fld('Upstream pressure', 'pup', 'bar(G)', '', '0.1'));
      h += H.sel('SERVICE FLUID CONDITION', 'svc', Object.keys(LIQ_SVC), 'Pump discharge');
      h += '<div id="lq-svcuser" style="display:none;">'
        + H.two(H.fld('Min velocity', 'vmin', 'm/s', '', '0.1'), H.fld('Max velocity', 'vmax', 'm/s', '', '0.1'))
        + H.fld('Allowable ΔP', 'dpallow', 'bar', '', '0.01') + '</div>';
      return h;
    },
    erosion: function (H) {
      return H.sel('SERVICE (C FACTOR)', 'cservice', Object.keys(LIQ_C), 'Continuous service')
        + H.fld('C factor value (API 14E)', 'cval', '', 125, '1')
        + H.fld('Allowable momentum flux (optional)', 'momlimit', 'kPa', '', '0.1');
    },
    props: function (g, t) {
      var rho = g('rho', 997), mu = g('mu', 1), Q = g('q', 100);
      return { rho: rho, mu: mu, Q: Q, W: Q * rho };
    },
    band: function (t, g) {
      var s = LIQ_SVC[t('svc', 'Pump discharge')];
      if (!s || s[0] == null) return { min: g('vmin', NaN), max: g('vmax', NaN), dp: g('dpallow', NaN) };
      return { min: s[0], max: s[1], dp: s[2] };
    },
    cfactor: function (t, g) { return g('cval', 125); },
    wire: function (H, recalc, g, t) {
      var fl = document.getElementById('lq-fluid');
      if (fl) fl.addEventListener('change', function () {
        var v = LIQUIDS[fl.value];
        var r = document.getElementById('lq-rho'), m = document.getElementById('lq-mu');
        /* The table is in kg/m³ (SI); writing it straight into the field
           left a US/CGS display showing "997" labelled lb/ft³ or g/cm³ —
           the same wrong-unit-substitution bug fixed elsewhere in the
           suite. Viscosity (cP) is unit-invariant across all three
           systems here, so it alone can be written as-is. */
        if (v && v[0] != null) { r.value = Number(CV(v[0], 'density').toFixed(6)).toString(); m.value = v[1]; } else { r.value = ''; m.value = ''; }
        recalc();
      });
      var sv = document.getElementById('lq-svc');
      var syncSvc = function () {
        var s = LIQ_SVC[sv.value];
        document.getElementById('lq-svcuser').style.display = (!s || s[0] == null) ? 'block' : 'none';
      };
      if (sv) { sv.addEventListener('change', function () { syncSvc(); recalc(); }); syncSvc(); }
      var cs = document.getElementById('lq-cservice'), cv = document.getElementById('lq-cval');
      var syncC = function () {
        var v = LIQ_C[cs.value];
        if (v != null) { cv.value = v; cv.readOnly = true; cv.style.background = 'rgba(34,197,94,0.08)'; cv.style.borderColor = '#22c55e'; cv.style.color = '#86efac'; }
        else { if (cv.readOnly) cv.value = ''; cv.readOnly = false; cv.style.background = 'rgba(2,6,18,0.6)'; cv.style.borderColor = 'var(--border-muted)'; cv.style.color = '#e2e8f0'; }
      };
      if (cs) { cs.addEventListener('change', function () { syncC(); recalc(); }); syncC(); }
    },
    reportProps: function (r, R) {
      return [['Fluid', R.esc(document.getElementById('lq-fluid') ? document.getElementById('lq-fluid').value : '—')],
              ['Density', R.U(r.rho, 'density', 2)],
              ['Viscosity', R.f3(r.mu) + ' cP'],
              ['Design volumetric flow', R.U(r.Q, 'vol-flow', 3)], ['Mass flow', R.U(r.W, 'mass-flow', 1)],
              ['Operating temperature', R.U(window.siOf ? window.siOf('lq-tnorm', 0) : 0, 'temperature', 1)]];
    },
    tag3d: function (r) { return 'LIQUID · ' + (r.velOk && r.eroOk && r.dpOk ? 'IN BAND' : 'REVIEW'); },
    sub3d: function (r) { return (document.getElementById('lq-fluid') || {}).value || 'liquid'; }
  });

  /* ═══════════ GAS ═══════════ */
  var GAS = make({
    key: 'gs', host: 'line-gas-content', tab: 'gas',
    momPhase: 'gas',
    title: 'GAS LINE SIZING', runLabel: 'GAS LINE SIZING', file: 'Gas_Line_Sizing_Report',
    dNps: 3, dSch: '160', dLen: 10, dDz: 20, dPup: 20, dPct: 30, tracer: 0xfcd34d, solid: false,
    basis: 'Gas density from the ideal-gas law with a compressibility factor.',
    ids: ['gas', 'mw', 'mu', 'pabs', 'z', 'q', 'tnorm', 'vmin', 'vmax', 'cval', 'momlimit'],
    required: [
      { n: 'q', label: 'Design volumetric flow' },
      { n: 'pabs', label: 'Absolute pressure' },
      { n: 'tnorm', label: 'Operating temperature' },
      { n: 'pup', label: 'Upstream pressure' },
      { n: 'mw', label: 'Molecular weight' },
      { n: 'mu', label: 'Viscosity' }
    ],
    manualNoun: 'A GAS LINE',
    manualLead: 'A gas line is compressible, so its density is worked out from the ideal-gas law at your stated '
      + 'pressure and temperature before anything else runs &mdash; there is no fixed density to look up.',
    manualProps: '<ol class="aro-doc-ol">'
      + '<li><b>Gas</b> &mdash; pick from the library. Molecular weight and viscosity are filled in for you; choosing '
      + '<i>User defined</i> leaves both blank.</li>'
      + '<li><b>Molecular weight</b> and <b>Viscosity</b> &mdash; overwrite whenever you have a gas-analysis figure.</li>'
      + '<li><b>Absolute pressure</b> and <b>Compressibility Z</b> &mdash; feed the density directly: '
      + '<b>&rho; = P&middot;MW / (Z&middot;R&middot;T)</b>. Z defaults to 1 (ideal gas); enter a real value from a '
      + 'chart or an equation of state for a non-ideal service.</li>'
      + '<li><b>Design volumetric flow</b> &mdash; at the stated pressure and temperature, not at standard conditions.</li>'
      + '</ol><p class="aro-doc-note">The computed density is shown live under the flow field, so a mistyped pressure '
      + 'or Z is visible immediately rather than buried in the result.</p>',
    manualService: '<ol class="aro-doc-ol">'
      + '<li><b>Operating temperature</b> &mdash; used in the density calculation above and, along with '
      + '<b>Upstream pressure</b>, in the downstream-pressure check.</li>'
      + '<li><b>Service Fluid</b> &mdash; sets the velocity band from the workbook table (instrument air, plant air, '
      + 'nitrogen, natural gas, flare header, vacuum lines, and others). <i>User defined</i> opens Min/Max velocity for '
      + 'you to enter.</li></ol>',
    manualErosion: '<p>Erosion follows API RP 14E exactly as for a liquid line, using the gas density computed in '
      + 'section 2: <b>Ve = C/&radic;&rho;</b>. Pick the <b>Service (C factor)</b> band &mdash; clean gas, dry natural '
      + 'gas, corrosive gas, gas carrying solids, offshore production &mdash; or enter your own C value. There is no '
      + '% setpoint for gas service: the line is checked directly against Ve.</p>',
    manualChecks: '<li><b>Line velocity</b> &mdash; against the band set by the Service Fluid.</li>'
      + '<li><b>Erosional velocity</b> &mdash; against the API RP 14E allowable, computed from the density in section 2.</li>'
      + '<li><b>Pressure drop</b> &mdash; gas service states no allowable &Delta;P per 100 m in the workbook table, so '
      + 'this check is informational; size against velocity and erosion, and confirm the total &Delta;P against your own '
      + 'process constraint.</li>',
    inputs: function (H) {
      var h = H.hdr('2 · PHYSICAL PROPERTIES');
      h += H.sel('GAS', 'gas', Object.keys(GASES), 'Hydrogen (H₂)');
      h += H.two(H.fld('Molecular weight', 'mw', 'kg/kmol', 2.016, '0.001'), H.fld('Viscosity', 'mu', 'cP', 0.0089, '0.0001'));
      h += H.two(H.fld('Absolute pressure', 'pabs', 'bar(a)', '', '0.1'), H.fld('Compressibility Z', 'z', '', 1, '0.01'));
      h += H.fld('Design volumetric flow', 'q', 'm³/hr', '', '1');
      h += H.hdr('3 · OPERATING CONDITIONS');
      h += H.two(H.fld('Operating temperature', 'tnorm', '°C', '', '1'), H.fld('Upstream pressure', 'pup', 'bar(G)', '', '0.1'));
      h += H.sel('SERVICE FLUID', 'svc', Object.keys(GAS_SVC), 'Nitrogen');
      h += '<div id="gs-svcuser" style="display:none;">'
        + H.two(H.fld('Min velocity', 'vmin', 'm/s', '', '0.1'), H.fld('Max velocity', 'vmax', 'm/s', '', '0.1')) + '</div>';
      h += '<div id="gs-rhoinfo" style="font-family:var(--font-mono);font-size:9px;color:#38bdf8;margin-top:4px;"></div>';
      return h;
    },
    erosion: function (H) {
      return H.sel('SERVICE (C FACTOR)', 'cservice', Object.keys(GAS_C), 'Non-corrosive gas')
        + H.fld('C factor value (API 14E)', 'cval', '', 175, '1')
        + H.fld('Allowable momentum flux (optional)', 'momlimit', 'kPa', '', '0.1');
    },
    props: function (g, t) {
      /* ρ = P·MW / (Z·R·T) — the workbook's ideal-gas form, P in Pa, T in K. */
      var P = g('pabs', 1) * 1e5, MW = g('mw', 2.016), Z = g('z', 1) || 1, T = g('tnorm', 15);
      var rho = (P * MW) / (Z * 8314.46 * (273.15 + T));
      var Q = g('q', 250);
      return { rho: rho, mu: g('mu', 0.0089), Q: Q, W: Q * rho, MW: MW, Z: Z, T: T, Pabs: g('pabs', 1) };
    },
    band: function (t, g) {
      var s = GAS_SVC[t('svc', 'Nitrogen')];
      if (!s || s[0] == null) return { min: g('vmin', NaN), max: g('vmax', NaN), dp: NaN };
      return { min: s[0], max: s[1], dp: NaN };
    },
    cfactor: function (t, g) { return g('cval', 175); },
    wire: function (H, recalc, g, t) {
      var gl = document.getElementById('gs-gas');
      if (gl) gl.addEventListener('change', function () {
        var v = GASES[gl.value], mw = document.getElementById('gs-mw'), mu = document.getElementById('gs-mu');
        if (v && v[0] != null) { mw.value = v[0]; mu.value = v[1]; } else { mw.value = ''; mu.value = ''; }
        recalc();
      });
      var sv = document.getElementById('gs-svc');
      var syncSvc = function () { var s = GAS_SVC[sv.value]; document.getElementById('gs-svcuser').style.display = (!s || s[0] == null) ? 'block' : 'none'; };
      if (sv) { sv.addEventListener('change', function () { syncSvc(); recalc(); }); syncSvc(); }
      var cs = document.getElementById('gs-cservice'), cv = document.getElementById('gs-cval');
      var syncC = function () {
        var v = GAS_C[cs.value];
        if (v != null) { cv.value = v; cv.readOnly = true; cv.style.background = 'rgba(34,197,94,0.08)'; cv.style.borderColor = '#22c55e'; cv.style.color = '#86efac'; }
        else { if (cv.readOnly) cv.value = ''; cv.readOnly = false; cv.style.background = 'rgba(2,6,18,0.6)'; cv.style.borderColor = 'var(--border-muted)'; cv.style.color = '#e2e8f0'; }
      };
      if (cs) { cs.addEventListener('change', function () { syncC(); recalc(); }); syncC(); }
    },
    rows: function (r, R) {
      var el = document.getElementById('gs-rhoinfo');
      if (el) el.textContent = 'Gas density ρ = P·MW / (Z·R·T) = ' + R.U(r.rho, 'density', 4);
      return R.row('Gas density (ideal gas)', R.U(r.rho, 'density', 4));
    },
    reportProps: function (r, R) {
      return [['Gas', R.esc((document.getElementById('gs-gas') || {}).value || '—')],
              ['Molecular weight', R.f3(r.props.MW) + ' kg/kmol'], ['Viscosity', R.f4(r.mu) + ' cP'],
              ['Absolute pressure', R.UG(r.props.Pabs, 'pressure', 2, '(a)')], ['Compressibility Z', R.f2(r.props.Z)],
              ['Temperature', R.U(r.props.T, 'temperature', 1)],
              ['Gas density  ρ = P·MW/(Z·R·T)', R.U(r.rho, 'density', 4)],
              ['Design volumetric flow', R.U(r.Q, 'vol-flow', 3)], ['Mass flow', R.U(r.W, 'mass-flow', 3)]];
    },
    tag3d: function (r) { return 'GAS · ' + (r.velOk && r.eroOk ? 'IN BAND' : 'REVIEW'); },
    sub3d: function (r) { return (document.getElementById('gs-gas') || {}).value || 'gas'; }
  });

  /* ═══════════ STEAM ═══════════ */
  /* Steam properties are taken twice — from the saturation table and from the
     workbook's correlation — and averaged, which is what the workbook calls
     its industry thumb rule. */
  function steamTable(pAbs) {
    var lo = STEAMTAB[0], hi = STEAMTAB[STEAMTAB.length - 1];
    for (var i = 0; i < STEAMTAB.length; i++) {
      if (STEAMTAB[i][0] <= pAbs) lo = STEAMTAB[i];
      if (STEAMTAB[i][0] >= pAbs) { hi = STEAMTAB[i]; break; }
    }
    if (lo[0] === hi[0]) return { T: lo[1], v: lo[2], rho: lo[3], h: lo[4], mu: lo[5] * 1e-6 };
    var w = (pAbs - lo[0]) / (hi[0] - lo[0]);
    var ip = function (a, b) { return a + (b - a) * w; };
    return { T: ip(lo[1], hi[1]), v: ip(lo[2], hi[2]), rho: ip(lo[3], hi[3]), h: ip(lo[4], hi[4]), mu: ip(lo[5], hi[5]) * 1e-6 };
  }
  var STEAM = make({
    key: 'st', host: 'line-steam-content', tab: 'steam',
    momPhase: 'steam',
    title: 'STEAM LINE SIZING', runLabel: 'STEAM LINE SIZING', file: 'Steam_Line_Sizing_Report',
    dNps: 0.5, dSch: '40', dLen: 10, dDz: 10, dPup: 19, noPct: true, tracer: 0xe2e8f0, solid: false,
    basis: 'Steam properties averaged from the saturation table and the workbook correlation.',
    ids: ['w', 'tnorm', 'vmin', 'vmax', 'cval', 'momlimit'],
    required: [
      { n: 'w', label: 'Steam mass flow' },
      { n: 'tnorm', label: 'Operating temperature' },
      { n: 'pup', label: 'Upstream pressure' }
    ],
    manualNoun: 'A STEAM LINE',
    manualLead: 'A steam line needs its density and enthalpy before velocity can be worked out at all, and whether it '
      + 'runs saturated or superheated changes the velocity band it is checked against.',
    manualProps: '<ol class="aro-doc-ol">'
      + '<li><b>Steam mass flow</b> &mdash; the duty. Volumetric flow is derived from it and the specific volume, so '
      + 'there is no separate flow field to fill in.</li>'
      + '<li>Density, specific volume, viscosity and enthalpy are read from a <b>saturation table</b> at the pressure '
      + 'you enter and from the workbook\'s own <b>correlation</b>, then <b>averaged</b> &mdash; this is the industry '
      + 'thumb rule the source workbook uses rather than a single steam-table lookup. Both figures and the average are '
      + 'shown live in the box under the temperature field, so you can see how far apart they sit.</li>'
      + '<li>The saturation temperature at your entered pressure is compared with the <b>operating temperature</b> you '
      + 'typed: above it, the line is treated as <b>SUPERHEATED</b>; at or below it, <b>SATURATED</b>.</li></ol>',
    manualService: '<ol class="aro-doc-ol">'
      + '<li><b>Operating temperature</b> &mdash; sets saturated vs superheated as above, and with '
      + '<b>Upstream pressure</b> feeds the downstream-pressure check.</li>'
      + '<li><b>Service Line</b> &mdash; branch lines, process lines, distribution mains, high-pressure mains, main '
      + 'header, or turbine inlet lines. Each carries <i>two</i> velocity bands in the workbook table, one for '
      + 'saturated and one for superheated service, and the one that applies is chosen automatically from the '
      + 'condition above. <i>User defined</i> opens a single Min/Max velocity pair for you to enter regardless of '
      + 'condition.</li></ol>',
    manualErosion: '<p>Erosion follows API RP 14E using the averaged density from section 2: <b>Ve = C/&radic;&rho;</b>. '
      + 'Pick the <b>Service (C factor)</b> band &mdash; clean dry steam, wet steam, or corrosive/wet service &mdash; or '
      + 'enter your own C value. There is no % setpoint for steam: the line is checked directly against Ve.</p>',
    manualChecks: '<li><b>Line velocity</b> &mdash; against whichever of the saturated or superheated bands applies for '
      + 'the Service Line selected.</li>'
      + '<li><b>Erosional velocity</b> &mdash; against the API RP 14E allowable, computed from the averaged density.</li>'
      + '<li><b>Pressure drop</b> &mdash; steam service states no allowable &Delta;P per 100 m in the workbook table, so '
      + 'this check is informational; size against velocity and erosion, and confirm the total &Delta;P against your own '
      + 'process constraint.</li>',
    inputs: function (H) {
      var h = H.hdr('2 · PHYSICAL PROPERTIES');
      h += H.fld('Steam mass flow', 'w', 'kg/hr', '', '1');
      h += H.two(H.fld('Operating temperature', 'tnorm', '°C', '', '1'), H.fld('Upstream pressure', 'pup', 'bar(G)', '', '0.1'));
      h += '<div id="st-props" style="font-family:var(--font-mono);font-size:9px;color:#38bdf8;line-height:1.6;margin-top:5px;background:rgba(56,189,248,0.06);border-left:2px solid #38bdf8;padding:6px 8px;border-radius:3px;"></div>';
      h += H.hdr('3 · SERVICE');
      h += H.sel('SERVICE LINE', 'svc', Object.keys(STEAM_SVC), 'Process lines');
      h += '<div id="st-svcuser" style="display:none;">'
        + H.two(H.fld('Min velocity', 'vmin', 'm/s', '', '0.1'), H.fld('Max velocity', 'vmax', 'm/s', '', '0.1')) + '</div>';
      return h;
    },
    erosion: function (H) {
      return H.sel('SERVICE (C FACTOR)', 'cservice', Object.keys(STEAM_C), 'Clean dry steam')
        + H.fld('C factor value (API 14E)', 'cval', '', 200, '1')
        + H.fld('Allowable momentum flux (optional)', 'momlimit', 'kPa', '', '0.1');
    },
    props: function (g, t) {
      var pg = g('pup', 19), pAbs = pg + 1;
      var tb = steamTable(pAbs);
      /* Correlation set, exactly as the workbook writes it. */
      var Tc = 99.97 + 44.3 * Math.log(pAbs);
      var vc = 0.194 / Math.pow(pAbs / 10, 0.92);
      var rc = 1 / vc;
      var muc = 0.000008 + (Tc / 374.14) * (0.00001731 - 0.000008);
      var hc = 2500 + 2 * Tc;
      var av = function (a, b) { return (a + b) / 2; };
      var T = av(tb.T, Tc), rho = av(tb.rho, rc), v = av(tb.v, vc), mu = av(tb.mu, muc), hh = av(tb.h, hc);
      var W = g('w', 100), Q = W * v;
      var sup = g('tnorm', 200) > T;
      return { rho: rho, mu: mu * 1000, Q: Q, W: W,           // μ to cP for the shared Reynolds form
               pAbs: pAbs, Tsat: tb.T, Tcorr: Tc, T: T, v: v, muPa: mu, h: hh, superheated: sup,
               tbl: tb, corr: { T: Tc, v: vc, rho: rc, mu: muc, h: hc } };
    },
    band: function (t, g, props) {
      var s = STEAM_SVC[t('svc', 'Process lines')];
      if (!s || s[0] == null && s[2] == null) return { min: g('vmin', NaN), max: g('vmax', NaN), dp: NaN };
      return props && props.superheated
        ? { min: s[2], max: s[3], dp: NaN }
        : { min: s[0], max: s[1], dp: NaN };
    },
    cfactor: function (t, g) { return g('cval', 200); },
    wire: function (H, recalc, g, t) {
      var sv = document.getElementById('st-svc');
      var syncSvc = function () { var s = STEAM_SVC[sv.value]; document.getElementById('st-svcuser').style.display = (!s || (s[0] == null && s[2] == null)) ? 'block' : 'none'; };
      if (sv) { sv.addEventListener('change', function () { syncSvc(); recalc(); }); syncSvc(); }
      var cs = document.getElementById('st-cservice'), cv = document.getElementById('st-cval');
      var syncC = function () {
        var v = STEAM_C[cs.value];
        if (v != null) { cv.value = v; cv.readOnly = true; cv.style.background = 'rgba(34,197,94,0.08)'; cv.style.borderColor = '#22c55e'; cv.style.color = '#86efac'; }
        else { if (cv.readOnly) cv.value = ''; cv.readOnly = false; cv.style.background = 'rgba(2,6,18,0.6)'; cv.style.borderColor = 'var(--border-muted)'; cv.style.color = '#e2e8f0'; }
      };
      if (cs) { cs.addEventListener('change', function () { syncC(); recalc(); }); syncC(); }
    },
    rows: function (r, R) {
      var p = r.props;
      var el = document.getElementById('st-props');
      if (el) el.innerHTML = 'At ' + R.UG(p.pAbs, 'pressure', 2, '(a)') + ' — table ' + R.U(p.tbl.T, 'temperature', 2) + ' / ' + R.U(p.tbl.rho, 'density', 3) + ', '
        + 'correlation ' + R.U(p.corr.T, 'temperature', 2) + ' / ' + R.U(p.corr.rho, 'density', 3) + '<br>Averaged: T ' + R.U(p.T, 'temperature', 2) + ' · ρ '
        + R.U(p.rho, 'density', 3) + ' · v ' + R.f4(p.v) + ' m³/kg · μ ' + p.muPa.toExponential(3) + ' Pa·s · h ' + R.f0(p.h) + ' kJ/kg · ' + (p.superheated ? 'SUPERHEATED' : 'SATURATED');
      return R.row('Steam condition', p.superheated ? 'SUPERHEATED' : 'SATURATED', p.superheated ? 'mid' : 'ok')
        + R.row('Saturation temperature', R.U(p.Tsat, 'temperature', 2))
        + R.row('Averaged density / specific volume', R.U(p.rho, 'density', 3) + '  ·  ' + R.f4(p.v) + ' m³/kg')
        + R.row('Enthalpy', R.f0(p.h) + ' kJ/kg');
    },
    reportProps: function (r, R) {
      var p = r.props;
      return [['Steam mass flow', R.U(r.W, 'mass-flow', 1)], ['Upstream pressure', R.UG(p.pAbs - 1, 'pressure', 2, '(G)') + '  =  ' + R.UG(p.pAbs, 'pressure', 2, '(a)')],
              ['Saturation temperature (table)', R.U(p.tbl.T, 'temperature', 2)], ['Correlation temperature', R.U(p.corr.T, 'temperature', 2)],
              ['Averaged temperature', R.U(p.T, 'temperature', 2)],
              ['Averaged density', R.U(p.rho, 'density', 3)],
              ['Averaged specific volume', R.f4(p.v) + ' m³/kg'],
              ['Averaged viscosity', p.muPa.toExponential(3) + ' Pa·s'],
              ['Averaged enthalpy', R.f0(p.h) + ' kJ/kg'],
              ['Steam condition', p.superheated ? 'SUPERHEATED' : 'SATURATED'],
              ['Volumetric flow  Q = W·v', R.U(r.Q, 'vol-flow', 3)]];
    },
    tag3d: function (r) { return 'STEAM · ' + (r.props.superheated ? 'SUPERHEATED' : 'SATURATED'); },
    /* sub3d is called with the result only — the render helpers are not in
       scope here, so go through the global formatter directly. */
    sub3d: function (r) {
      var sys = window.activeUnitSystem || 'SI';
      var sym = (window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS['pressure']) ? window.UNIT_CONVERSIONS['pressure'].symbol(sys) : 'bar';
      var suffix = sym === 'bar' ? '(a)' : '';
      return (window.fromSIDisplay ? window.fromSIDisplay('pressure', r.props.pAbs, 2)
                                   : r.props.pAbs.toFixed(2) + ' bar') + suffix;
    }
  });
  function R2(v) { return isFinite(v) ? v.toFixed(2) : '—'; }

  /* ═══════════ SLURRY ═══════════ */
  var SLURRY = make({
    key: 'sl', host: 'line-slurry-content', tab: 'slurry',
    momPhase: 'slurry',
    title: 'SLURRY LINE SIZING', runLabel: 'SLURRY LINE SIZING', file: 'Slurry_Line_Sizing_Report',
    dNps: 0.75, dSch: '40', dLen: 10, dDz: 10, dPup: 3, noPct: true, usesKmat: true, tracer: 0xd4a13a,
    required: [
      { n: 'ws', label: 'Solid mass flow' },
      { n: 'wl', label: 'Carrier mass flow' },
      { n: 'pup', label: 'Upstream pressure' },
      { n: 'rhos', label: 'Solid density' },
      { n: 'rhol', label: 'Carrier density' },
      { n: 'mul', label: 'Carrier viscosity' }
    ],
    manualNoun: 'A SLURRY LINE',
    manualLead: 'A slurry line has a third failure mode a clean fluid does not: run it too slowly and the solids '
      + 'settle out and build a bed, long before erosion or an ordinary velocity check would ever flag it. Slurry '
      + 'sizing is built around that deposition limit as much as the usual velocity and erosion checks.',
    manualProps: '<ol class="aro-doc-ol">'
      + '<li><b>Solid</b> and <b>Carrier Liquid</b> &mdash; pick both from their libraries; density (and the carrier\'s '
      + 'viscosity) fill in for you, converted to the active unit system. <i>User defined</i> on either leaves it blank.</li>'
      + '<li><b>Solid density</b>, <b>Carrier density</b>, <b>Carrier viscosity</b> &mdash; overwrite whenever a lab or '
      + 'datasheet figure differs from the library value.</li>'
      + '<li><b>Solid mass flow</b> and <b>Carrier mass flow</b> &mdash; entered separately. From them the panel works '
      + 'out solids concentration by weight (Cw) and by volume (&phi;), the mixture density &rho;m by mass balance, and '
      + 'the mixture viscosity &mu;m by the <b>Thomas correlation</b>. All four are shown live in the box under the '
      + 'flow fields.</li></ol>',
    manualService: '<ol class="aro-doc-ol">'
      + '<li><b>Upstream pressure</b> &mdash; feeds the downstream-pressure check.</li>'
      + '<li><b>Vc design margin</b> &mdash; the percentage added on top of the critical deposition velocity (see '
      + 'below) to arrive at the velocity the line is actually designed to run at. A larger margin runs the line '
      + 'faster and safer against settling, at the cost of more friction loss.</li>'
      + '<li><b>Slurry Service</b> &mdash; sets the velocity band from the workbook table, banded by how heavily '
      + 'loaded and abrasive the mixture is (fine clay through to iron ore and magnetite). <i>User defined</i> opens '
      + 'Min/Max velocity for you to enter.</li></ol>',
    manualErosion: '<p>A slurry line is limited by its <b>pipe material</b>, not by an API RP 14E C factor: '
      + '<b>Ve = K&middot;&radic;(&rho;m/1000)</b>, where K is the material erosion factor and &rho;m the mixture '
      + 'density from section 2. K is read from the <b>Pipe Material</b> chosen in section 4 &mdash; carbon steel, the '
      + 'stainless grades, HDPE, rubber-lined and the rest each carry a different K &mdash; so a material with a '
      + 'higher erosion resistance directly raises the allowable velocity for the same mixture. <i>User defined</i> '
      + 'material opens a field to enter K yourself.</p>'
      + '<p>Underneath, the panel also works out the <b>Durand critical deposition velocity Vc</b> from the solids '
      + 'concentration, the solid/carrier density difference and the bore, using the workbook\'s own lookup table '
      + 'banded on Cw. The <b>designed velocity</b> is Vc plus the Vc design margin from section 3, and the line\'s '
      + 'actual velocity is checked against it directly &mdash; this is the check that catches a line sized only for '
      + 'erosion but too slow to keep solids in suspension.</p>',
    manualChecks: '<li><b>Deposition velocity</b> &mdash; the line velocity against the designed Vc (Durand critical '
      + 'velocity plus the margin from section 3). Below it, solids settle and build a bed; this is checked '
      + 'independently of, and usually before, the ordinary velocity band.</li>'
      + '<li><b>System behaviour</b> &mdash; a plain-language summary spanning both limits: REJECT (settling) below '
      + 'Vc, WARNING (deposition risk) up to 1.1&times;Vc, ACCEPTABLE between there and the material erosion limit, '
      + 'REJECT (erosion risk) above it.</li>'
      + '<li><b>Line velocity</b> &mdash; against the band set by the Slurry Service.</li>'
      + '<li><b>Erosional velocity</b> &mdash; against the pipe-material limit computed above.</li>'
      + '<li><b>Pressure drop</b> &mdash; slurry service states no allowable &Delta;P per 100 m in the workbook table, '
      + 'so this check is informational; size against deposition velocity and material erosion, and confirm the total '
      + '&Delta;P against your own process constraint.</li>',
    eroTitle: 'EROSIONAL VELOCITY (PIPE MATERIAL LIMIT)',
    eroReport: function (r, R) {
      return [['Basis', 'Pipe material erosion limit, not an API RP 14E C factor'],
              ['Pipe material', R.esc(r.matName)],
              ['Material erosion factor K', isFinite(r.kMat) ? R.U(r.kMat, 'velocity', 2) : '—'],
              ['Slurry density ρm', R.U(r.rho, 'density', 2)],
              ['Specific gravity SGm = ρm/1000', R.f4(r.rho / 1000)],
              ['Erosional velocity Ve = K·√SGm', R.U(r.Ve, 'velocity', 3)],
              ['Allowable velocity', R.U(r.Vallow, 'velocity', 3)]];
    },
    eroRows: function (r, R) {
      return R.row('Pipe material', R.esc(r.matName))
        + R.row('Material erosion factor K', isFinite(r.kMat) ? R.U(r.kMat, 'velocity', 2) : '—')
        + R.row('Slurry density ρm', R.U(r.rho, 'density', 2))
        + R.row('Specific gravity SGm = ρm/1000', R.f4(r.rho / 1000))
        + R.row('Ve = K·√SGm', R.U(r.Ve, 'velocity', 3))
        + R.row('Allowable velocity', R.U(r.Vallow, 'velocity', 3));
    },
    basis: 'Slurry density by mass balance, viscosity by the Thomas correlation and deposition velocity by Durand.',
    ids: ['solid', 'carrier', 'rhos', 'rhol', 'mul', 'ws', 'wl', 'vcpct', 'vmin', 'vmax', 'momlimit'],
    inputs: function (H) {
      var h = H.hdr('2 · PHYSICAL PROPERTIES');
      h += H.two(H.sel('SOLID', 'solid', Object.keys(SOLIDS), 'Coal'), H.sel('CARRIER LIQUID', 'carrier', Object.keys(CARRIERS), 'Water'));
      h += H.two(H.fld('Solid density', 'rhos', 'kg/m³', 1300, '1'), H.fld('Carrier density', 'rhol', 'kg/m³', 998, '1'));
      h += H.fld('Carrier viscosity', 'mul', 'cP', 1, '0.01');
      h += H.two(H.fld('Solid mass flow', 'ws', 'kg/hr', '', '1'), H.fld('Carrier mass flow', 'wl', 'kg/hr', '', '1'));
      h += '<div id="sl-mix" style="font-family:var(--font-mono);font-size:9px;color:#38bdf8;line-height:1.6;margin-top:5px;background:rgba(56,189,248,0.06);border-left:2px solid #38bdf8;padding:6px 8px;border-radius:3px;"></div>';
      h += H.hdr('3 · SERVICE');
      h += H.two(H.fld('Upstream pressure', 'pup', 'bar(G)', '', '0.1'), H.fld('Vc design margin', 'vcpct', '%', 20, '1'));
      h += H.fld('Allowable momentum flux (optional)', 'momlimit', 'kPa', '', '0.1');
      h += H.sel('SLURRY SERVICE', 'svc', Object.keys(SLU_SVC), 'Water + fine clay');
      h += '<div id="sl-svcuser" style="display:none;">'
        + H.two(H.fld('Min velocity', 'vmin', 'm/s', '', '0.1'), H.fld('Max velocity', 'vmax', 'm/s', '', '0.1')) + '</div>';
      return h;
    },
    erosion: function (H) {
      return '<div style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;line-height:1.5;margin-bottom:4px;">A slurry line is limited by its pipe material, not by an API C factor: Ve = K·√(ρm/1000), with K taken from the material selected in section 4.</div>';
    },
    props: function (g, t) {
      var rhoS = g('rhos', 1300), rhoL = g('rhol', 998), muL = g('mul', 1);
      var Ws = g('ws', 700), Wl = g('wl', 700);
      var W = Ws + Wl;
      var Cw = W > 0 ? Ws / W : 0;                                   // solids by weight
      var phi = (Ws / rhoS) / ((Ws / rhoS) + (Wl / rhoL));           // by volume
      var rho = 1 / ((Cw / rhoS) + ((1 - Cw) / rhoL));               // slurry density
      /* Thomas correlation for the slurry viscosity. */
      var mu = muL * (1 + 2.5 * phi + 10.05 * phi * phi + 0.00273 * Math.exp(16.6 * phi));
      return { rho: rho, mu: mu, Q: W / rho, W: W, rhoS: rhoS, rhoL: rhoL, muL: muL, Ws: Ws, Wl: Wl, Cw: Cw, phi: phi };
    },
    band: function (t, g) {
      var s = SLU_SVC[t('svc', 'Water + fine clay')];
      if (!s || s[0] == null) return { min: g('vmin', NaN), max: g('vmax', NaN), dp: NaN };
      return { min: s[0], max: s[1], dp: NaN };
    },
    cfactor: function () { return NaN; },
    /* Durand deposition velocity and the material erosion limit. */
    extra: function (r, g, t) {
      var p = r.props;
      /* Durand factor exactly as the workbook looks it up: the breakpoints are
         written as 0, 5, 10 … 40 and the lookup is made on Cw as a fraction,
         so any Cw below 5 lands in the first band. Reproduced as written so
         the numbers reconcile with the sheet, and reported alongside the
         percentage the table was drawn for. */
      var brk = [0, 5, 10, 15, 20, 25, 30, 35, 40], vals = [0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7];
      var F = vals[0];
      for (var bi = 0; bi < brk.length; bi++) if (p.Cw >= brk[bi]) F = vals[bi];
      r.F = F;
      r.Fpct = (function () { var f = vals[0], c = p.Cw * 100;
        for (var i = 0; i < brk.length; i++) if (c >= brk[i]) f = vals[i]; return f; })();
      r.Vc = F * Math.pow(2 * 9.81 * r.D * ((p.rhoS - p.rhoL) / p.rhoL), 0.5);
      r.vcPct = g('vcpct', 20);
      r.VcDes = r.Vc * (1 + r.vcPct / 100);
      r.vcOk = r.V >= r.VcDes;
      r.Ve = isFinite(r.kMat) ? r.kMat * Math.sqrt(r.rho / 1000) : NaN;
      r.Vallow = r.Ve;
      r.eroOk = r.V < r.Ve;
      r.behaviour = r.V < r.Vc ? 'REJECT — solids settling'
        : r.V < 1.1 * r.Vc ? 'WARNING — deposition risk'
        : r.V <= r.Ve ? 'ACCEPTABLE' : 'REJECT — erosion risk';
    },
    checks: function (r, R) {
      return [{ ok: r.vcOk, label: 'Deposition velocity', detail: R.U(r.V, 'velocity', 2) + ' against a designed Vc of ' + R.U(r.VcDes, 'velocity', 2) },
              { ok: /ACCEPTABLE/.test(r.behaviour), label: 'System behaviour', detail: r.behaviour }];
    },
    advice: function (r, R) {
      var out = [];
      if (!r.vcOk) out.push({ title: 'Raise the velocity above the deposition limit',
        why: 'At ' + R.U(r.V, 'velocity', 2) + ' the line is below the designed critical deposition velocity of ' + R.U(r.VcDes, 'velocity', 2) + ', so solids will drop out and build a bed. Drop a pipe size or raise the flow.', apply: null });
      if (/erosion/.test(r.behaviour)) out.push({ title: 'Reduce the velocity or change the pipe material',
        why: 'The line is above the material erosion limit of ' + R.U(r.Ve, 'velocity', 2) + ' for ' + R.esc(r.matName) + '. A larger bore, or a harder lining with a higher K factor, brings it back.', apply: null });
      return out;
    },
    wire: function (H, recalc, g, t) {
      var so = document.getElementById('sl-solid'), ca = document.getElementById('sl-carrier');
      if (so) so.addEventListener('change', function () {
        var v = SOLIDS[so.value], e = document.getElementById('sl-rhos');
        // Table is kg/m³ (SI) — convert before writing, same fix as Liquid's fluid preset.
        e.value = (v && v[0] != null) ? Number(CV(v[0], 'density').toFixed(6)).toString() : ''; recalc();
      });
      if (ca) ca.addEventListener('change', function () {
        var v = CARRIERS[ca.value], d = document.getElementById('sl-rhol'), m = document.getElementById('sl-mul');
        if (v && v[0] != null) { d.value = Number(CV(v[0], 'density').toFixed(6)).toString(); m.value = v[1]; } else { d.value = ''; m.value = ''; }
        recalc();
      });
      var sv = document.getElementById('sl-svc');
      var syncSvc = function () { var s = SLU_SVC[sv.value]; document.getElementById('sl-svcuser').style.display = (!s || s[0] == null) ? 'block' : 'none'; };
      if (sv) { sv.addEventListener('change', function () { syncSvc(); recalc(); }); syncSvc(); }
    },
    rows: function (r, R) {
      var p = r.props;
      var el = document.getElementById('sl-mix');
      if (el) el.innerHTML = 'Cw ' + R.f4(p.Cw) + ' by weight · φ ' + R.f4(p.phi) + ' by volume<br>ρm ' + R.U(p.rho, 'density', 3)
        + ' · μm ' + R.f3(p.mu) + ' cP (Thomas) · Q ' + R.U(r.Q, 'vol-flow', 4);
      return R.row('Solids by weight Cw', R.f4(p.Cw))
        + R.row('Solids by volume φ', R.f4(p.phi))
        + R.row('Slurry density ρm', R.U(p.rho, 'density', 3))
        + R.row('Slurry viscosity μm (Thomas)', R.f3(p.mu) + ' cP')
        + R.row('Durand factor F (workbook lookup)', R.f2(r.F))
        + R.row('F if read at Cw = ' + R.f1(r.props.Cw * 100) + ' %', R.f2(r.Fpct))
        + R.row('Critical deposition velocity Vc', R.U(r.Vc, 'velocity', 3))
        + R.row('Designed Vc (+' + R.f0(r.vcPct) + ' %)', R.U(r.VcDes, 'velocity', 3))
        + R.row('V ≥ designed Vc', r.vcOk ? 'YES' : 'NO', r.vcOk ? 'ok' : 'warn')
        + R.row('System behaviour', r.behaviour, /ACCEPTABLE/.test(r.behaviour) ? 'ok' : 'warn');
    },
    reportProps: function (r, R) {
      var p = r.props;
      return [['Solid', R.esc((document.getElementById('sl-solid') || {}).value || '—')],
              ['Carrier', R.esc((document.getElementById('sl-carrier') || {}).value || '—')],
              ['Solid / carrier density', R.CV(p.rhoS, 'density').toFixed(1) + ' / ' + R.U(p.rhoL, 'density', 1)],
              ['Carrier viscosity', R.f3(p.muL) + ' cP'],
              ['Solid / carrier mass flow', R.CV(p.Ws, 'mass-flow').toFixed(1) + ' / ' + R.U(p.Wl, 'mass-flow', 1)],
              ['Total mass flow', R.U(r.W, 'mass-flow', 1)],
              ['Solids by weight Cw', R.f4(p.Cw)], ['Solids by volume φ', R.f4(p.phi)],
              ['Slurry density ρm', R.U(p.rho, 'density', 3)],
              ['Slurry viscosity μm (Thomas)', R.f3(p.mu) + ' cP'],
              ['Volumetric flow  Q = W/ρm', R.U(r.Q, 'vol-flow', 4)]];
    },
    reportFlow: function (r, R) {
      return [['Durand factor F (workbook lookup on Cw as a fraction)', R.f2(r.F)],
              ['F if the table is read at Cw = ' + R.f1(r.props.Cw * 100) + ' %', R.f2(r.Fpct)], ['Critical deposition velocity Vc', R.f3(r.Vc) + ' m/s'],
              ['Designed Vc', R.U(r.VcDes, 'velocity', 3)], ['V ≥ designed Vc', r.vcOk ? 'YES' : 'NO'],
              ['Material erosion factor K', isFinite(r.kMat) ? R.U(r.kMat, 'velocity', 2) : '—'],
              ['Erosional velocity  Ve = K·√(ρm/1000)', R.U(r.Ve, 'velocity', 3)],
              ['System behaviour', r.behaviour]];
    },
    tag3d: function (r) { return 'SLURRY · ' + r.behaviour.split(' ')[0]; },
    sub3d: function (r) { return 'Cw ' + R2(r.props.Cw) + ' · ρm ' + R2(r.props.rho); }
  });

  window.AROLINE = { liquid: LIQ, gas: GAS, steam: STEAM, slurry: SLURRY,
                     PIPE: PIPE, MAT: MAT, FIT_NAMES: FIT_NAMES, kBand: kBand };

  function boot() { [LIQ, GAS, STEAM, SLURRY].forEach(function (m) { try { m.build(); } catch (e) { console.error('AROLINE build', e); } }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 350); });
  else setTimeout(boot, 350);
})();
