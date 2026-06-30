// 2026 CMM weekly — FW01-FW20: Mass Product data | FW21-FW26: Actual CMM Daily Inspection _2026.xlsx
// Calculation: each inspection row = 1 measurement step; std time = per-column time from Combined ST
//   e.g. V172 Outer=180min, Inner1=250min, Inner2=240min, InnerAsm=45min, OuterRGap=45min, Asm=120min
// V172 tiered: first 30 completed sets (Assembly steps) @ full rate, set 31+ @ 50% rate
// Last synced from: CMM Daily Inspection _2026.xlsx (up to FW26 / 2026-06-26)
export const cmmStdTimeData2026 = {
  capacityWeek: 154,
  weeklySummary: [
    // ── FW01–FW20: Mass Product (forecast/planned) ──────────────────────────
    {week:'FW01',totalHours:23.7,totalSets:3,capacity:154,utilization:15.4,overload:false,source:'Mass Product',byPart:[{part:'2.8-127 Pitch O-Bearing',sets:2,hours:14.8,std_min:445},{part:'Cypress Pitch Bearing',sets:1,hours:8.8,std_min:530}]},
    {week:'FW02',totalHours:20.0,totalSets:3,capacity:154,utilization:13.0,overload:false,source:'Mass Product',byPart:[{part:'2.8-127 Pitch O-Bearing',sets:2,hours:14.8,std_min:445},{part:'1.6 Hybrid Glass Pitch Bearing',sets:1,hours:5.2,std_min:310}]},
    {week:'FW03',totalHours:25.2,totalSets:4,capacity:154,utilization:16.4,overload:false,source:'Mass Product',byPart:[{part:'2.8-127 Pitch O-Bearing',sets:2,hours:14.8,std_min:445},{part:'1.6 Hybrid Glass Pitch Bearing',sets:1,hours:5.2,std_min:310},{part:'2.x Yaw Bearing',sets:1,hours:5.2,std_min:310}]},
    {week:'FW04',totalHours:40.2,totalSets:5,capacity:154,utilization:26.1,overload:false,source:'Mass Product',byPart:[{part:'Sierra N1 Pitch Bearing',sets:2,hours:17.7,std_min:530},{part:'2.8-127 Pitch O-Bearing',sets:2,hours:14.8,std_min:445},{part:'1.x-97 Pitch Bearing',sets:1,hours:7.7,std_min:460}]},
    {week:'FW05',totalHours:28.8,totalSets:4,capacity:154,utilization:18.7,overload:false,source:'Mass Product',byPart:[{part:'2.8-127 Pitch O-Bearing',sets:2,hours:14.8,std_min:445},{part:'Sierra N1 Pitch Bearing',sets:1,hours:8.8,std_min:530},{part:'1.6 Hybrid Glass Pitch Bearing',sets:1,hours:5.2,std_min:310}]},
    {week:'FW06',totalHours:40.2,totalSets:5,capacity:154,utilization:26.1,overload:false,source:'Mass Product',byPart:[{part:'Sierra N1 Pitch Bearing',sets:2,hours:17.7,std_min:530},{part:'2.8-127 Pitch O-Bearing',sets:2,hours:14.8,std_min:445},{part:'1.x-97 Pitch Bearing',sets:1,hours:7.7,std_min:460}]},
    {week:'FW07',totalHours:33.5,totalSets:7,capacity:154,utilization:21.8,overload:false,source:'Mass Product',byPart:[{part:'Sierra N1 Yaw Bearing',sets:1,hours:8.8,std_min:530},{part:'1.x-97 Pitch Bearing',sets:1,hours:7.7,std_min:460},{part:'1.6 Hybrid Glass Pitch Bearing',sets:1,hours:5.2,std_min:310},{part:'Sierra N1 Pitch Bearing',sets:1,hours:4.8,std_min:530},{part:'Cypress Pitch Bearing',sets:1,hours:4.0,std_min:530},{part:'2.x Yaw Bearing',sets:1,hours:3.0,std_min:310}]},
    {week:'FW09',totalHours:33.0,totalSets:4,capacity:154,utilization:21.4,overload:false,source:'Mass Product',byPart:[{part:'1.x-97 Pitch Bearing',sets:2,hours:15.3,std_min:460},{part:'Cypress Yaw Bearing',sets:1,hours:8.8,std_min:530},{part:'Sierra N1 Pitch Bearing',sets:1,hours:8.8,std_min:530}]},
    {week:'FW10',totalHours:18.3,totalSets:3,capacity:154,utilization:11.9,overload:false,source:'Mass Product',byPart:[{part:'1.x-97 Pitch Bearing',sets:2,hours:15.3,std_min:460},{part:'2.x Yaw Bearing',sets:1,hours:3.0,std_min:310}]},
    {week:'FW11',totalHours:36.8,totalSets:5,capacity:154,utilization:23.9,overload:false,source:'Mass Product',byPart:[{part:'1.x-97 Pitch Bearing',sets:2,hours:15.3,std_min:460},{part:'Sierra N1 Yaw Bearing',sets:1,hours:8.8,std_min:530},{part:'2.8-127 Pitch O-Bearing',sets:1,hours:7.4,std_min:445},{part:'2.x Yaw Bearing',sets:1,hours:5.2,std_min:310}]},
    {week:'FW12',totalHours:10.5,totalSets:2,capacity:154,utilization:6.8,overload:false,source:'Mass Product',byPart:[{part:'2.5-116 Pitch Bearing',sets:1,hours:5.3,std_min:320},{part:'2.x Yaw Bearing',sets:1,hours:5.2,std_min:310}]},
    {week:'FW13',totalHours:20.2,totalSets:3,capacity:154,utilization:13.1,overload:false,source:'Mass Product',byPart:[{part:'2.8-127 Pitch O-Bearing',sets:2,hours:14.8,std_min:445},{part:'2.5-116 Pitch Bearing',sets:1,hours:5.3,std_min:320}]},
    {week:'FW14',totalHours:28.2,totalSets:4,capacity:154,utilization:18.3,overload:false,source:'Mass Product',byPart:[{part:'Sierra N1 Yaw Bearing',sets:1,hours:8.8,std_min:530},{part:'Cypress Pitch Bearing',sets:1,hours:8.8,std_min:530},{part:'2.5-116 Pitch Bearing',sets:1,hours:5.3,std_min:320},{part:'2.x Yaw Bearing',sets:1,hours:5.2,std_min:310}]},
    {week:'FW15',totalHours:21.4,totalSets:3,capacity:154,utilization:13.9,overload:false,source:'Mass Product',byPart:[{part:'Cypress Pitch Bearing',sets:1,hours:8.8,std_min:530},{part:'2.8-127 Pitch O-Bearing',sets:1,hours:7.4,std_min:445},{part:'2.x Yaw Bearing',sets:1,hours:5.2,std_min:310}]},
    {week:'FW16',totalHours:28.8,totalSets:4,capacity:154,utilization:18.7,overload:false,source:'Mass Product',byPart:[{part:'2.8-127 Pitch O-Bearing',sets:2,hours:14.8,std_min:445},{part:'Sierra N1 Yaw Bearing',sets:1,hours:8.8,std_min:530},{part:'1.6 Hybrid Glass Pitch Bearing',sets:1,hours:5.2,std_min:310}]},
    {week:'FW17',totalHours:20.0,totalSets:3,capacity:154,utilization:13.0,overload:false,source:'Mass Product',byPart:[{part:'2.8-127 Pitch O-Bearing',sets:2,hours:14.8,std_min:445},{part:'1.6 Hybrid Glass Pitch Bearing',sets:1,hours:5.2,std_min:310}]},
    {week:'FW18',totalHours:33.8,totalSets:5,capacity:154,utilization:21.9,overload:false,source:'Mass Product',byPart:[{part:'2.8-127 Pitch O-Bearing',sets:2,hours:14.8,std_min:445},{part:'Sierra N1 Pitch Bearing',sets:1,hours:8.8,std_min:530},{part:'2.5-116 Pitch Bearing',sets:1,hours:5.3,std_min:320},{part:'Cypress Yaw Bearing',sets:1,hours:4.8,std_min:530}]},
    {week:'FW19',totalHours:0.0,totalSets:0,capacity:154,utilization:0.0,overload:false,source:'Mass Product',byPart:[]},
    {week:'FW20',totalHours:24.4,totalSets:5,capacity:154,utilization:15.8,overload:false,source:'Mass Product',byPart:[{part:'2.8-127 Pitch O-Bearing',sets:2,hours:11.8,std_min:445},{part:'2.5-116 Pitch Bearing',sets:1,hours:5.3,std_min:320},{part:'2.x Yaw Bearing',sets:1,hours:5.2,std_min:310},{part:'1.6 Hybrid Glass Pitch Bearing',sets:1,hours:2.2,std_min:310}]},

    // ── FW21–FW26: Actual CMM Daily Inspection _2026.xlsx ───────────────────
    // Each row = 1 measurement step; std time = per-column standard time from Combined ST
    // V172 tiered: 36 completed sets (Assembly steps) — first 30 @ full rate, set 31-36 @ 50%
    {week:'FW21',totalHours:44.7,totalSets:21,capacity:154,utilization:29.0,overload:false,source:'CMM Daily Inspection',byPart:[
      {part:'V172 Blade Bearing',sets:21,hours:44.7,std_min:null},
    ]},
    {week:'FW22',totalHours:8.2,totalSets:11,capacity:154,utilization:5.3,overload:false,source:'CMM Daily Inspection',byPart:[
      {part:'V172 Blade Bearing',sets:11,hours:8.2,std_min:null},
    ]},
    {week:'FW23',totalHours:77.8,totalSets:35,capacity:154,utilization:50.5,overload:false,source:'CMM Daily Inspection',byPart:[
      {part:'V172 Blade Bearing',sets:34,hours:75.8,std_min:null},
      {part:'EP5 Yaw',sets:1,hours:2.0,std_min:null},
    ]},
    {week:'FW24',totalHours:81.8,totalSets:34,capacity:154,utilization:53.1,overload:false,source:'CMM Daily Inspection',byPart:[
      {part:'V172 Blade Bearing',sets:34,hours:81.8,std_min:null},
    ]},
    {week:'FW25',totalHours:51.6,totalSets:26,capacity:154,utilization:33.5,overload:false,source:'CMM Daily Inspection',byPart:[
      {part:'2.8-127 Pitch O-Bearing',sets:3,hours:22.2,std_min:445},
      {part:'V172 Blade Bearing',sets:21,hours:16.5,std_min:null},
      {part:'Sierra N1 Yaw Bearing',sets:1,hours:8.8,std_min:530},
      {part:'Sierra N1 Pitch Bearing',sets:1,hours:4.0,std_min:530},
    ]},
    {week:'FW26',totalHours:87.2,totalSets:30,capacity:154,utilization:56.6,overload:false,source:'CMM Daily Inspection',byPart:[
      {part:'15MW Yaw Ring',sets:2,hours:20.8,std_min:625},
      {part:'V172 Blade Bearing',sets:17,hours:16.6,std_min:null},
      {part:'Sierra N1 Pitch Bearing',sets:3,hours:12.8,std_min:530},
      {part:'2.8-127 Pitch O-Bearing',sets:4,hours:9.6,std_min:445},
      {part:'Sierra N1 Yaw Bearing',sets:1,hours:8.8,std_min:530},
      {part:'Rotor Lock Disc',sets:1,hours:8.0,std_min:480},
      {part:'14MW Yaw Ring',sets:1,hours:6.5,std_min:390},
      {part:'Cypress Pitch Bearing',sets:1,hours:4.0,std_min:530},
    ]},
  ],
  overloadWeeks: [],
  // FW01-FW20 mass product: 487.0h | FW21-FW26 actual: 351.3h
  grandTotalHours: 838.3,
  totalSets: 157,
  fwRange: 'FW01–FW26',
  year: 2026,
  lastSynced: 'CMM Daily Inspection _2026.xlsx · đến FW26 (26/06/2026)',
};
