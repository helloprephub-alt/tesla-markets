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
          {active.id === 'vehicles' ? <div className="tm-market-modal-list">{vehicleItems.map(item => <button key={item.id} onClick={() => onSelectModel(item.id)}><span>{item.name}</span><ArrowUpRight size={15}/></button>)}</div> : <div className="tm-market-subcategory-grid">{(subcategories[active.id] || []).map(item => <button key={item.title} onClick={() => { setActiveDepartment(null); onEnquire(`Product department enquiry: ${active.title} — ${item.title}. Please share product options, specifications and availability.`); }}><b>{item.title}</b><small>{item.description}</small><span>Enquire about this collection <ArrowUpRight size={14}/></span></button>)}</div>}
          <p className="tm-market-modal-note">Catalogue items and final availability will be published as each supplier and product listing is verified.</p>
        </section>
      </div>}
    </main>
  );
}

function ArrowDownRightFallback() {
  return <ArrowUpRight size={15}/>;
}
