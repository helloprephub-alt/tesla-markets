import { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, BatteryCharging, CarFront, ChevronRight, PlugZap, Search, Shirt, Sun, Wrench, X } from 'lucide-react';

type Props = {
  onSelectModel: (id: string) => void;
  onEnquire: (context: string) => void;
};

const departments = [
  { id: 'vehicles', title: 'Tesla Vehicles', description: 'Explore the vehicle collection and request availability.', count: '5 collections', icon: CarFront, tone: 'vehicle' },
  { id: 'solar', title: 'Solar & Energy', description: 'Solar panels, home energy storage and power systems.', count: '5 collections', icon: Sun, tone: 'solar' },
  { id: 'charging', title: 'EV Charging', description: 'Home and destination charging equipment and accessories.', count: '3 collections', icon: PlugZap, tone: 'charging' },
  { id: 'accessories', title: 'Accessories', description: 'Vehicle accessories, practical upgrades and essentials.', count: 'Coming catalogue', icon: Wrench, tone: 'accessories' },
  { id: 'lifestyle', title: 'Clothing & Lifestyle', description: 'Apparel and everyday lifestyle collections.', count: 'Coming catalogue', icon: Shirt, tone: 'lifestyle' },
  { id: 'batteries', title: 'Batteries & Inverters', description: 'Battery storage, inverters and backup power equipment.', count: '4 collections', icon: BatteryCharging, tone: 'batteries' },
];


type CatalogueProduct = { id: string; department: string; category: string; name: string; description: string; availability: string };
const catalogue: CatalogueProduct[] = [
  {id:'m3-floor-mats',department:'accessories',category:'Model 3 Accessories',name:'Model 3 All-Weather Floor Mats',description:'Interior floor protection. Fitment and model-year compatibility confirmed before order.',availability:'Enquire for availability'},
  {id:'m3-trunk-mat',department:'accessories',category:'Model 3 Accessories',name:'Model 3 Cargo & Trunk Mat',description:'Cargo-area protection for everyday use.',availability:'Enquire for availability'},
  {id:'m3-console',department:'accessories',category:'Model 3 Accessories',name:'Model 3 Centre Console Organiser',description:'Interior storage organiser. Compatibility subject to vehicle year.',availability:'Enquire for availability'},
  {id:'m3-screen',department:'accessories',category:'Model 3 Accessories',name:'Model 3 Screen Protector',description:'Display protection accessory with fitment checked before purchase.',availability:'Enquire for availability'},
  {id:'m3-sunshade',department:'accessories',category:'Model 3 Accessories',name:'Model 3 Glass Roof Sunshade',description:'Cabin shade accessory for compatible configurations.',availability:'Enquire for availability'},
  {id:'my-floor-mats',department:'accessories',category:'Model Y Accessories',name:'Model Y All-Weather Floor Mats',description:'Interior floor protection. Fitment and model-year compatibility confirmed before order.',availability:'Enquire for availability'},
  {id:'my-cargo',department:'accessories',category:'Model Y Accessories',name:'Model Y Cargo & Trunk Mat',description:'Cargo-area protection for everyday use.',availability:'Enquire for availability'},
  {id:'my-organiser',department:'accessories',category:'Model Y Accessories',name:'Model Y Storage Organiser',description:'Practical storage accessory for compatible Model Y interiors.',availability:'Enquire for availability'},
  {id:'my-screen',department:'accessories',category:'Model Y Accessories',name:'Model Y Screen Protector',description:'Display protection accessory with fitment checked before purchase.',availability:'Enquire for availability'},
  {id:'cyber-bed',department:'accessories',category:'Cybertruck Accessories',name:'Cybertruck Bed Protection',description:'Utility-bed protection enquiry. Configuration and fitment to be confirmed.',availability:'Enquire for availability'},
  {id:'cyber-mats',department:'accessories',category:'Cybertruck Accessories',name:'Cybertruck Interior Mat Set',description:'Interior protection accessory. Compatibility to be confirmed.',availability:'Enquire for availability'},
  {id:'wall-connector',department:'charging',category:'Wall Connectors',name:'Home Wall Connector',description:'Fixed home EV charging equipment. Electrical assessment may be required.',availability:'Enquire for availability'},
  {id:'mobile-connector',department:'charging',category:'Mobile Chargers',name:'Mobile EV Charging Connector',description:'Portable charging equipment. Plug and regional compatibility must be checked.',availability:'Enquire for availability'},
  {id:'charging-cable',department:'charging',category:'Charging Accessories',name:'EV Charging Cable',description:'Charging cable options with connector compatibility confirmed before order.',availability:'Enquire for availability'},
  {id:'charging-adapter',department:'charging',category:'Charging Accessories',name:'Charging Adapter',description:'Adapter options for supported vehicle and charger combinations.',availability:'Enquire for availability'},
  {id:'solar-panel-400',department:'solar',category:'Solar Panels',name:'Residential Solar Panel',description:'Residential panel options. Output, dimensions and certification supplied with quote.',availability:'Request a quote'},
  {id:'solar-panel-commercial',department:'solar',category:'Solar Panels',name:'Commercial Solar Panel',description:'Commercial panel options for project sizing and supplier confirmation.',availability:'Request a quote'},
  {id:'solar-mount',department:'solar',category:'Solar Accessories',name:'Solar Mounting Rail & Bracket Kit',description:'Roof or ground mounting components selected for the installation type.',availability:'Enquire for availability'},
  {id:'solar-cable',department:'solar',category:'Solar Accessories',name:'Solar DC Cable & Connector Set',description:'Solar wiring and connector options with specification confirmation.',availability:'Enquire for availability'},
  {id:'solar-protection',department:'solar',category:'Solar Accessories',name:'Solar DC Protection & Combiner Box',description:'Protection and combiner equipment sized to the system design.',availability:'Request a quote'},
  {id:'lifepo4-5',department:'batteries',category:'Lithium Batteries',name:'5 kWh LiFePO4 Battery',description:'Residential energy storage option. Voltage, BMS and compatibility to be confirmed.',availability:'Request a quote'},
  {id:'lifepo4-10',department:'batteries',category:'Lithium Batteries',name:'10 kWh LiFePO4 Battery',description:'Residential energy storage option. Voltage, BMS and compatibility to be confirmed.',availability:'Request a quote'},
  {id:'rack-battery',department:'batteries',category:'Lithium Batteries',name:'48V Rack-Mount Battery',description:'Modular battery option for compatible inverter systems.',availability:'Request a quote'},
  {id:'hybrid-inverter',department:'batteries',category:'Inverters',name:'Hybrid Solar Inverter',description:'Hybrid inverter options selected to match panel and battery configuration.',availability:'Request a quote'},
  {id:'offgrid-inverter',department:'batteries',category:'Inverters',name:'Off-Grid Inverter',description:'Off-grid inverter options for standalone power systems.',availability:'Request a quote'},
  {id:'gridtie-inverter',department:'batteries',category:'Inverters',name:'Grid-Tie Inverter',description:'Grid-connected inverter options subject to local requirements.',availability:'Request a quote'},
  {id:'home-storage',department:'batteries',category:'Home Battery Storage',name:'Home Energy Storage System',description:'Home backup and storage enquiry. Installation assessment and local availability required.',availability:'Request a quote'},
  {id:'commercial-storage',department:'batteries',category:'Commercial Storage',name:'Commercial Energy Storage System',description:'Large-scale storage enquiry with project sizing and supplier consultation.',availability:'Request a quote'},
  {id:'apparel-tee',department:'lifestyle',category:'Apparel',name:'Everyday Graphic T-Shirt',description:'Lifestyle apparel listing. Brand, sizing and supplier authenticity confirmed before sale.',availability:'Enquire for availability'},
  {id:'apparel-cap',department:'lifestyle',category:'Apparel',name:'Everyday Cap',description:'Lifestyle accessory listing. Brand and supplier details confirmed before sale.',availability:'Enquire for availability'},
  {id:'lifestyle-bottle',department:'lifestyle',category:'Lifestyle',name:'Reusable Travel Bottle',description:'Everyday lifestyle product. Specifications and supplier details confirmed before sale.',availability:'Enquire for availability'},
];

const vehicleItems = [
  { id: 'model-3', name: 'Model 3', image: '/resources/model-3-1.jpg', detail: 'Electric sedan' },
  { id: 'model-y', name: 'Model Y', image: '/resources/model-y-1.jpg', detail: 'Electric SUV' },
  { id: 'cybertruck', name: 'Cybertruck', image: '/resources/cybertruck-1.jpg', detail: 'All-electric pickup' },
  { id: 'roadster', name: 'Roadster', image: '/resources/roadster-1.jpg', detail: 'Performance vehicle' },
  { id: 'semi', name: 'Tesla Semi', image: '/resources/semi-1.jpg', detail: 'Electric truck' },
];

const subcategories: Record<string, { title: string; description: string }[]> = {
  solar: [
    { title: 'Solar Panels', description: 'Residential and commercial solar panel enquiries' },
    { title: 'Solar Accessories', description: 'Mounting, wiring, protection and connection equipment' },
    { title: 'Solar Packages', description: 'System sizing and installation enquiries' },
  ],
  batteries: [
    { title: 'Home Battery Storage', description: 'Home energy storage and backup systems' },
    { title: 'Lithium Batteries', description: 'LiFePO4 and other battery configurations' },
    { title: 'Inverters', description: 'Hybrid, off-grid and grid-tie inverter enquiries' },
    { title: 'Commercial Storage', description: 'Large-scale energy storage enquiries' },
  ],
  charging: [
    { title: 'Wall Connectors', description: 'Home and workplace EV charging' },
    { title: 'Mobile Chargers', description: 'Portable charging equipment and cables' },
    { title: 'Charging Accessories', description: 'Adapters, connectors and installation accessories' },
  ],
  accessories: [
    { title: 'Model 3 Accessories', description: 'Interior, exterior and practical accessories' },
    { title: 'Model Y Accessories', description: 'Interior, exterior and practical accessories' },
    { title: 'Cybertruck Accessories', description: 'Utility and vehicle accessories' },
  ],
  lifestyle: [
    { title: 'Apparel', description: 'Clothing collection enquiries' },
    { title: 'Lifestyle', description: 'Everyday products and branded merchandise enquiries' },
  ],
};

export function Marketplace({ onSelectModel, onEnquire }: Props) {
  const [activeDepartment, setActiveDepartment] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [search, setSearch] = useState('');
  const active = departments.find(item => item.id === activeDepartment);
  const filteredVehicles = useMemo(() => vehicleItems.filter(item => (item.name + ' ' + item.detail).toLowerCase().includes(search.toLowerCase())), [search]);

  return (
    <main className="tm-marketplace">
      <section className="tm-market-hero">
        <div className="tm-market-hero-copy">
          <span className="tm-market-eyebrow">TESLA MARKETS / THE COLLECTION</span>
          <h1>Discover your<br /><em>next essential.</em></h1>
          <p>Explore vehicles, energy products, charging equipment and selected lifestyle collections in one destination.</p>
          <div className="tm-market-hero-actions">
            <a href="#tm-departments">Explore departments <ArrowDownRightFallback /></a>
            <span>Exclusive collections · Enquiry-led availability</span>
          </div>
        </div>
        <div className="tm-market-hero-art">
          <img src="/resources/tesla-hero.jpg" alt="Tesla Markets featured vehicle" />
          <div className="tm-market-art-label"><b>TESLA MARKETS</b><span>CURATED COLLECTIONS</span></div>
        </div>
      </section>

      <section className="tm-market-promo">
        <div><span>FEATURED COLLECTIONS</span><h2>One marketplace.<br /><em>More to explore.</em></h2></div>
        <p>Product availability, configurations and delivery are confirmed with the management team before an order is finalised.</p>
      </section>

      <section className="tm-market-section" id="tm-departments">
        <div className="tm-market-section-head"><div><span className="tm-market-eyebrow">SHOP BY DEPARTMENT</span><h2>Explore the <em>departments.</em></h2></div><span className="tm-market-count">06 COLLECTION AREAS</span></div>
        <div className="tm-department-grid">
          {departments.map(({id,title,description,count,icon:Icon,tone}) => (
            <button className={`tm-department-card ${tone}`} key={id} onClick={() => setActiveDepartment(id)}>
              <span className="tm-department-icon"><Icon size={22}/></span><span className="tm-department-copy"><b>{title}</b><small>{description}</small><em>{count} <ArrowUpRight size={14}/></em></span><ChevronRight className="tm-department-chevron" size={18}/>
            </button>
          ))}
        </div>
      </section>

      <section className="tm-market-section tm-market-vehicles">
        <div className="tm-market-section-head"><div><span className="tm-market-eyebrow">THE VEHICLE COLLECTION</span><h2>Explore <em>Tesla vehicles.</em></h2></div><span className="tm-market-count">05 MODELS</span></div>
        <label className="tm-market-search"><Search size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search vehicle collection" /><span>{filteredVehicles.length} results</span></label>
        <div className="tm-vehicle-grid">
          {filteredVehicles.map(item => <button className="tm-vehicle-card" key={item.id} onClick={() => onSelectModel(item.id)}>
            <div className="tm-vehicle-image"><img src={item.image} alt={item.name} loading="lazy"/><span>VIEW MODEL <ArrowUpRight size={13}/></span></div>
            <div className="tm-vehicle-info"><div><b>{item.name}</b><small>{item.detail}</small></div><ArrowRight size={17}/></div>
          </button>)}
        </div>
      </section>

      <section className="tm-market-contact"><div><span className="tm-market-eyebrow">NEED HELP CHOOSING?</span><h2>Talk to the <em>team.</em></h2><p>Ask about product specifications, availability, configurations or delivery arrangements.</p></div><button onClick={() => onEnquire('Marketplace product enquiry — I would like help choosing a product and checking availability.')}>Contact management <ArrowUpRight size={16}/></button></section>

      {active && <div className="tm-market-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setActiveDepartment(null); }}>
        <section className="tm-market-modal" role="dialog" aria-modal="true" aria-labelledby="tm-department-title">
          <div className="tm-market-modal-head"><div><span className="tm-market-eyebrow">DEPARTMENT COLLECTION</span><h2 id="tm-department-title">{active.title}</h2><p>{active.description}</p></div><button onClick={() => setActiveDepartment(null)} aria-label="Close department"><X size={20}/></button></div>
          {active.id === 'vehicles' ? <div className="tm-market-modal-list">{vehicleItems.map(item => <button key={item.id} onClick={() => onSelectModel(item.id)}><span>{item.name}</span><ArrowUpRight size={15}/></button>)}</div> : activeCategory ? <div className="tm-catalogue-view"><button className="tm-catalogue-back" onClick={() => {setActiveCategory(null);setCatalogueSearch('');}}>← All {active.title} collections</button><label className="tm-market-search"><Search size={17}/><input value={catalogueSearch} onChange={event=>setCatalogueSearch(event.target.value)} placeholder={`Search ${activeCategory}`}/></label><div className="tm-catalogue-grid">{catalogue.filter(item=>item.department===active.id&&item.category===activeCategory&&(item.name+' '+item.description).toLowerCase().includes(catalogueSearch.toLowerCase())).map(item=><article className="tm-catalogue-card" key={item.id}><div className="tm-catalogue-card-art"><Wrench size={24}/><span>{item.category}</span></div><div className="tm-catalogue-card-body"><b>{item.name}</b><p>{item.description}</p><small>{item.availability}</small><button onClick={()=>{setActiveDepartment(null);setActiveCategory(null);onEnquire(`Product enquiry: ${item.name}. ${item.description} Please confirm current availability, specification, final price and delivery options.`);}}>Enquire about product <ArrowUpRight size={14}/></button></div></article>)}</div></div> : <div className="tm-market-subcategory-grid">{(subcategories[active.id] || []).map(item => <button key={item.title} onClick={() => { setActiveCategory(item.title); setCatalogueSearch(''); }}><b>{item.title}</b><small>{item.description}</small><span>View products <ArrowUpRight size={14}/></span></button>)}</div>}
          <p className="tm-market-modal-note">Listings are enquiry-led. Prices, stock, product authenticity, specifications and delivery are confirmed before an order is accepted. Tesla branding does not imply that every accessory is manufactured or endorsed by Tesla.</p>
        </section>
      </div>}
    </main>
  );
}

function ArrowDownRightFallback() {
  return <ArrowUpRight size={15}/>;
}
