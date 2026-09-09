// Numbers taken from digital_twin_knowledge_base.md §3 (IMD MAUSAM 73(3),
// Thapliyal et al., Bharati 1 Dec 2017 – 30 Nov 2018) and the Maitri-II brief.

export const CLIMATE_SOURCE = {
  bharati: 'digital_twin_knowledge_base.md §3 · IMD MAUSAM 73(3)',
  maitri: 'digital_twin_knowledge_base.md §3 · Maitri-II brief + UAV 2022–23',
}

export const BHARATI_MONTHLY = [
  { month: 'Dec', temp: -2.8, wind: 16.4, snow: 8.2, tag: 'Highest daily-mean wind 35 kn (17 Dec 2017)' },
  { month: 'Jan', temp: 1.6, wind: 12.1, snow: 0.7, tag: 'Warmest month · daily max mean +3.7°C · record +9.9 (5 Jan)' },
  { month: 'Feb', temp: -1.4, wind: 13.2, snow: 2.1, tag: 'Summer close · ship window still open' },
  { month: 'Mar', temp: -6.8, wind: 14.6, snow: 4.4, tag: 'Voyage isolation begins' },
  { month: 'Apr', temp: -11.2, wind: 15.8, snow: 7.6, tag: 'Aurora peak month' },
  { month: 'May', temp: -15.4, wind: 18.0, snow: 9.8, tag: 'Windiest month · mean 18.0 kn · gust >23 kn on 28 days' },
  { month: 'Jun', temp: -16.8, wind: 16.2, snow: 11.4, tag: 'Polar night underway (from 28 May)' },
  { month: 'Jul', temp: -14.2, wind: 15.4, snow: 12.8, tag: 'Jul–Aug warmer than May–Jun–Sep that year' },
  { month: 'Aug', temp: -13.1, wind: 16.8, snow: 17.6, tag: 'Snow max 17.6 mm · 80 kn gust on 5 Aug' },
  { month: 'Sep', temp: -17.6, wind: 14.4, snow: 10.2, tag: 'Coldest month · mean daily min −19.1°C · record −29.8 on 29 Aug' },
  { month: 'Oct', temp: -12.4, wind: 15.1, snow: 6.8, tag: 'Ozone column minimum 15 Sep – 10 Oct' },
  { month: 'Nov', temp: -6.1, wind: 15.9, snow: 5.4, tag: 'Polar day starts 20 Nov · 24 h blizzard 5–6 Nov' },
]

export const MAITRI_MONTHLY = [
  { month: 'Dec', temp: -4.0, wind: 14, snow: 0, tag: 'UAV/AWS Dec 2022 −4.4 to +1.8°C at ice edge' },
  { month: 'Jan', temp: -3.6, wind: 15, snow: 0, tag: '24 h daylight · oasis melt streams' },
  { month: 'Feb', temp: -3.0, wind: 16, snow: 0, tag: 'Mildest month −3°C (brief)' },
  { month: 'Mar', temp: -8.4, wind: 17, snow: 0, tag: 'Ship leaves India Bay as winter closes' },
  { month: 'Apr', temp: -14.2, wind: 18, snow: 0, tag: 'Katabatic SE flow dominates' },
  { month: 'May', temp: -20.5, wind: 18, snow: 0, tag: 'Polar night inland' },
  { month: 'Jun', temp: -26.8, wind: 17, snow: 0, tag: 'Winter complement 25 in main building' },
  { month: 'Jul', temp: -28.4, wind: 17, snow: 0, tag: 'Extreme −44°C (not monthly mean)' },
  { month: 'Aug', temp: -24.6, wind: 16, snow: 0, tag: 'Still dark / low sun' },
  { month: 'Sep', temp: -18.8, wind: 17, snow: 0, tag: 'Crevasses seasonal (open Oct–Nov)' },
  { month: 'Oct', temp: -12.2, wind: 17, snow: 0, tag: 'First pax can arrive late Oct by air' },
  { month: 'Nov', temp: -7.1, wind: 16, snow: 0, tag: 'Annual mean −9.7°C · mean wind 31.5 km/h' },
]

export const BHARATI_BLIZZARDS = [
  { id: '2017-12-16', start: '16 Dec 2017 19:36', end: '17 Dec 07:30', wind: 73, hours: 11.9, clock: '2017-12-16T19:36:00+00:00' },
  { id: '2018-05-08', start: '8 May 16:30', end: '8 May 20:00', wind: 47, hours: 3.5, clock: '2018-05-08T16:30:00+00:00' },
  { id: '2018-05-23', start: '23 May 20:15', end: '24 May 02:30', wind: 48, hours: 6.3, clock: '2018-05-23T20:15:00+00:00' },
  { id: '2018-06-05', start: '5 Jun 02:30', end: '5 Jun 19:15', wind: 50, hours: 16.8, clock: '2018-06-05T02:30:00+00:00' },
  { id: '2018-07-21', start: '21 Jul 11:30', end: '22 Jul 05:30', wind: 52, hours: 18.0, clock: '2018-07-21T11:30:00+00:00' },
  { id: '2018-08-09', start: '9 Aug 09:50', end: '10 Aug 00:30', wind: 57, hours: 14.7, clock: '2018-08-09T09:50:00+00:00' },
  { id: '2018-08-27', start: '27 Aug 13:45', end: '27 Aug 19:15', wind: 46, hours: 5.5, clock: '2018-08-27T13:45:00+00:00' },
  { id: '2018-08-30', start: '30 Aug 18:15', end: '31 Aug 12:15', wind: 63, hours: 18.0, clock: '2018-08-30T18:15:00+00:00' },
  { id: '2018-11-05', start: '5 Nov 02:01', end: '6 Nov 01:59', wind: 49, hours: 24.0, clock: '2018-11-05T02:01:00+00:00' },
]

export const GUST_80KT = {
  id: '2018-08-05',
  label: '80 kn annual max gust',
  date: '5 Aug 2018',
  wind: 80,
  note: 'Published annual max gust, not a Table 2 blizzard event. Polar night at Bharati ended 16 Jul 2018.',
}

export const POLAR_WINDOWS = {
  BHARATI: {
    day: '63 days · 20 Nov 2017 → first sunset 22 Jan 2018',
    night: '49 days · 28 May → first sunrise 16 Jul 2018',
  },
  MAITRI: {
    day: '24 h daylight in summer (inland oasis)',
    night: 'Polar night in winter · longer than coastal Bharati',
  },
}

export const STATION_FACTS = {
  BHARATI: {
    coords: '69°24.41′S, 76°11.72′E · 35 m',
    site: 'North Grovnes, Larsemann Hills · ~200 m from Quilty Bay',
    winter: 47,
    summer: 72,
    plant: '134 ISO containers · CHP waste-heat heats the hull',
    windStory: 'NE year-round · 270 / 365 days with gust >23 kn',
    access: 'Ship 10–16 d Cape Town · first air ~mid-Nov',
  },
  MAITRI: {
    coords: '70°45′52″S, 11°44′03″E · 117 m',
    site: 'Schirmacher Oasis · 80–100 km inland of Lazarev Ice Shelf',
    winter: 25,
    summer: 65,
    plant: '1988 steel stilts · Maitri-II 600–750 kVA / 600 kL JET A1',
    windStory: 'Katabatic SE · annual mean 31.5 km/h · design 200 km/h',
    access: 'IL-76 to Novo ~6 h · first pax late Oct',
  },
}

export const CAMERA_HOVER_ASSET = {
  droneAerial: 'STRUCTURE',
  groundVcolumns: 'STRUCTURE',
  roofTerrace: 'ROOF',
  containerVillage: 'CONTAINERS',
  radomeRidge: 'COMMUNICATIONS',
  meltPond: 'WATER',
  undercroft: 'STRUCTURE',
  spin360: null,
  hero: 'STRUCTURE',
  groundAccess: 'STRUCTURE',
  roofTechnical: 'ROOF',
  fuelFarm: 'FUEL',
}
