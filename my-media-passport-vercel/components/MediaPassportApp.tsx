"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Check, ChevronRight, Clock3, Film, Heart, Home, Library, Minus, Pencil, Plus, Search, Sparkles, Star, Trash2, Tv, X } from "lucide-react";
import type { HomeData, MediaItem, SearchItem, UpdateItem } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/status";

type View = "home"|"search"|"library"|"updates";
type ApiState<T> = {loading:boolean; data:T|null; error:string};

const emptyHome:HomeData={total:0,counts:{},watching:[],favorites:[],recent:[],profile:null};

async function api<T>(url:string, init?:RequestInit):Promise<T>{
  const res=await fetch(url,{...init,headers:{"content-type":"application/json",...(init?.headers||{})}});
  const json=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(json.error||"No pudimos completar la operación.");
  return json as T;
}

function truthy(v:unknown){return v===true||["true","verdadero","yes","si","sí","1"].includes(String(v??"").toLowerCase());}
function num(v:unknown){const n=Number(v||0);return Number.isFinite(n)?n:0;}
function formatDate(ms?:number){if(!ms)return"";return new Intl.DateTimeFormat("es-SV",{weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}).format(new Date(ms));}

export default function MediaPassportApp(){
  const [view,setView]=useState<View>("home");
  const [home,setHome]=useState<ApiState<HomeData>>({loading:true,data:null,error:""});
  const [library,setLibrary]=useState<ApiState<MediaItem[]>>({loading:false,data:null,error:""});
  const [updates,setUpdates]=useState<ApiState<any>>({loading:false,data:null,error:""});
  const [toast,setToast]=useState("");
  const [libraryStatus,setLibraryStatus]=useState("");
  const [libraryType,setLibraryType]=useState("");

  const notify=(msg:string)=>{setToast(msg);window.setTimeout(()=>setToast(""),2600)};
  const loadHome=async()=>{setHome(s=>({...s,loading:true,error:""}));try{setHome({loading:false,data:await api<HomeData>("/api/home"),error:""})}catch(e){setHome({loading:false,data:null,error:e instanceof Error?e.message:"Error"})}};
  const loadLibrary=async(force=false)=>{if(library.data&&!force)return;setLibrary(s=>({...s,loading:true,error:""}));try{setLibrary({loading:false,data:await api<MediaItem[]>("/api/library"),error:""})}catch(e){setLibrary({loading:false,data:null,error:e instanceof Error?e.message:"Error"})}};
  const loadUpdates=async(force=false)=>{if(updates.data&&!force)return;setUpdates(s=>({...s,loading:true,error:""}));try{setUpdates({loading:false,data:await api<any>("/api/updates"),error:""})}catch(e){setUpdates({loading:false,data:null,error:e instanceof Error?e.message:"Error"})}};
  useEffect(()=>{loadHome()},[]);
  useEffect(()=>{if(view==="library")loadLibrary();if(view==="updates")loadUpdates()},[view]);

  const syncItem=(item:MediaItem)=>{
    setLibrary(s=>s.data?{...s,data:s.data.map(x=>String(x.ID)===String(item.ID)?{...x,...item}:x)}:s);
    setHome(s=>s.data?{...s,data:{...s.data,
      watching:s.data.watching.map(x=>String(x.ID)===String(item.ID)?{...x,...item}:x).filter(x=>x.Status==="Watching"),
      favorites:s.data.favorites.map(x=>String(x.ID)===String(item.ID)?{...x,...item}:x).filter(x=>truthy(x.Favorite)),
      recent:s.data.recent.map(x=>String(x.ID)===String(item.ID)?{...x,...item}:x)
    }}:s);
  };
  const mutate=async(id:string, body:any, optimistic?:Partial<MediaItem>)=>{
    const before=library.data?.find(x=>String(x.ID)===String(id));
    if(before&&optimistic)syncItem({...before,...optimistic});
    try{const result=await api<MediaItem>(`/api/media/${id}`,{method:"PATCH",body:JSON.stringify(body)});syncItem(result);await loadHome();setUpdates({loading:false,data:null,error:""});return result}
    catch(e){if(before)syncItem(before);notify(e instanceof Error?e.message:"Error");throw e}
  };
  const changeProgress=async(item:MediaItem,dir:1|-1)=>{
    let p=num(item.Progress)+(dir===1?1:-1);p=Math.max(0,p);const total=num(item.Total);if(total)p=Math.min(p,total);
    let status=String(item.Status);if(item.Type==="Movie"){p=dir===1?1:0;status=dir===1?"Completed":"Plan to Watch"}else if(dir===1){if(total&&p>=total)status="Completed";else if(status==="Plan to Watch")status="Watching"}else{if(p===0&&(status==="Watching"||status==="Completed"))status="Plan to Watch";else if(p>0&&status==="Completed")status="Watching";}
    await mutate(String(item.ID),{action:dir===1?"increment":"decrement"},{Progress:p,Status:status});
  };
  const navigate=(v:View)=>setView(v);
  const openFiltered=(status:string)=>{setLibraryStatus(status);setView("library")};

  return <div className="app-shell">
    <Ambient/>
    <header className="topbar"><div className="brand"><span className="brand-mark">M</span><span>media</span><b>passport</b></div><div className="desktop-nav"><NavButtons view={view} setView={navigate}/></div></header>
    <main className="main-wrap">
      <div key={view} className="view-enter">
        {view==="home"&&<HomeView state={home} onRetry={loadHome} onFilter={openFiltered} onViewLibrary={()=>navigate("library")} onProgress={changeProgress} notify={notify} refreshLibrary={()=>loadLibrary(true)}/>} 
        {view==="search"&&<SearchView notify={notify} refreshHome={loadHome} refreshLibrary={()=>loadLibrary(true)}/>} 
        {view==="library"&&<LibraryView state={library} status={libraryStatus} setStatus={setLibraryStatus} type={libraryType} setType={setLibraryType} onRetry={()=>loadLibrary(true)} onProgress={changeProgress} mutate={mutate} notify={notify} refreshHome={loadHome} setLibrary={setLibrary}/>} 
        {view==="updates"&&<UpdatesView state={updates} onRetry={()=>loadUpdates(true)}/>} 
      </div>
    </main>
    <nav className="bottom-nav"><NavButtons view={view} setView={navigate} mobile/></nav>
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function Ambient(){return <><div className="orb orb-a"/><div className="orb orb-b"/><div className="noise"/></>}
function NavButtons({view,setView,mobile=false}:{view:View;setView:(v:View)=>void;mobile?:boolean}){const items:[View,string,any][]=[["home","Inicio",Home],["search","Buscar",Search],["library","Mi lista",Library],["updates","Novedades",Bell]];return <>{items.map(([v,label,Icon])=><button key={v} className={`nav-btn ${view===v?"active":""}`} onClick={()=>setView(v)}><Icon size={mobile?21:16}/><span>{label}</span></button>)}</>}

function LoadingBlock({cards=4}:{cards?:number}){return <div className="skeleton-grid">{Array.from({length:cards}).map((_,i)=><div className="skeleton-card" key={i}><div className="sk poster"/><div className="sk line lg"/><div className="sk line"/></div>)}</div>}
function ErrorBox({message,onRetry}:{message:string;onRetry:()=>void}){return <div className="state-box"><div className="state-icon">!</div><h3>No pudimos cargar esta información</h3><p>{message}</p><button className="primary-btn" onClick={onRetry}>Reintentar</button></div>}
function Empty({children}:{children:React.ReactNode}){return <div className="empty-box">{children}</div>}

function HomeView({state,onRetry,onFilter,onViewLibrary,onProgress,notify,refreshLibrary}:{state:ApiState<HomeData>;onRetry:()=>void;onFilter:(s:string)=>void;onViewLibrary:()=>void;onProgress:(i:MediaItem,d:1|-1)=>void;notify:(s:string)=>void;refreshLibrary:()=>void}){
  const [favOpen,setFavOpen]=useState(false); const data=state.data||emptyHome;
  if(state.loading&&!state.data)return <><HeroSkeleton/><LoadingBlock/></>;
  if(state.error&&!state.data)return <ErrorBox message={state.error} onRetry={onRetry}/>;
  const p=data.profile;
  return <>
    <section className="profile-hero">
      <div className="hero-glow"/><div className="profile-line"><div className="avatar">{p?.AvatarURL?<img src={p.AvatarURL} alt="Avatar"/>:<span>{(p?.Username||"MP").slice(0,2).toUpperCase()}</span>}</div><div><div className="eyebrow">MY MEDIA PASSPORT</div><h1>{p?.Username||"DK04"}</h1><p className="handle">{p?.Handle||"@dk04"}</p></div></div>
      <div className="stats-grid"><Stat n={data.total} label="Total" onClick={()=>onFilter("")}/><Stat n={data.counts.Watching||0} label="Viendo" onClick={()=>onFilter("Watching")}/><Stat n={data.counts.Completed||0} label="Ya la vi" onClick={()=>onFilter("Completed")}/><Stat n={data.counts["Plan to Watch"]||0} label="Próximo" onClick={()=>onFilter("Plan to Watch")}/><Stat n={data.counts["On Hold"]||0} label="En pausa" onClick={()=>onFilter("On Hold")}/><Stat n={data.counts.Dropped||0} label="Abandonado" onClick={()=>onFilter("Dropped")}/></div>
    </section>
    <Section title="Mis favoritos" subtitle="Tu top 5 personal" action={data.favorites.length<5?<button className="ghost-btn" onClick={()=>setFavOpen(true)}><Plus size={16}/> Añadir</button>:undefined}>
      <Favorites items={data.favorites} onAdd={()=>setFavOpen(true)}/>
    </Section>
    <Section title="Agregados recientemente" subtitle="Tus últimas incorporaciones" action={<button className="text-btn" onClick={onViewLibrary}>Ver lista <ChevronRight size={15}/></button>}><PosterGrid items={data.recent}/></Section>
    <Section title="Viendo ahora" subtitle="Continúa donde lo dejaste"><WatchingList items={data.watching} onProgress={onProgress}/></Section>
    {favOpen&&<FavoriteModal close={()=>setFavOpen(false)} notify={notify} onChanged={async()=>{setFavOpen(false);await Promise.all([onRetry(),refreshLibrary()])}}/>}
  </>
}
function HeroSkeleton(){return <div className="profile-hero"><div className="profile-line"><div className="sk round"/><div className="grow"><div className="sk line sm"/><div className="sk line xl"/><div className="sk line sm"/></div></div><div className="stats-grid">{Array.from({length:6}).map((_,i)=><div className="stat-card" key={i}><div className="sk line lg"/><div className="sk line"/></div>)}</div></div>}
function Stat({n,label,onClick}:{n:number;label:string;onClick:()=>void}){return <button className="stat-card" onClick={onClick}><strong>{n}</strong><span>{label}</span></button>}
function Section({title,subtitle,action,children}:{title:string;subtitle?:string;action?:React.ReactNode;children:React.ReactNode}){return <section className="section"><div className="section-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>{children}</section>}
function Score({value}:{value:unknown}){if(value===""||value===undefined||value===null)return null;return <span className="score"><Star size={11} fill="currentColor"/>{String(value)}</span>}
function Poster({item,className=""}:{item:MediaItem;className?:string}){return <div className={`poster-card ${className}`}>{item.PosterURL?<img src={String(item.PosterURL)} alt={String(item.Title||"Poster")} loading="lazy"/>:<div className="poster-placeholder"><Film/></div>}<Score value={item.Score}/><div className="poster-gradient"/><div className="poster-copy"><b>{item.Title}</b><span>{item.Type} {item.Year?`· ${item.Year}`:""}</span></div></div>}
function Favorites({items,onAdd}:{items:MediaItem[];onAdd:()=>void}){const slots=[0,1,2,3,4];return <div className="favorites-grid">{slots.map((i)=>items[i]?<Poster item={items[i]} key={i} className={i===0?"favorite-big":""}/>:<button key={i} className={`favorite-empty ${i===0?"favorite-big":""}`} onClick={onAdd}><Plus/><span>Añadir favorito</span></button>)}</div>}
function PosterGrid({items}:{items:MediaItem[]}){return items.length?<div className="poster-grid">{items.map(i=><Poster key={i.ID} item={i}/>)}</div>:<Empty>Aún no hay títulos recientes.</Empty>}
function WatchingList({items,onProgress}:{items:MediaItem[];onProgress:(i:MediaItem,d:1|-1)=>void}){if(!items.length)return <Empty>No tienes títulos en “Viendo” ahora.</Empty>;return <div className="watch-list">{items.map(i=>{const p=num(i.Progress),t=num(i.Total),pct=t?Math.min(100,p/t*100):0;return <div className="watch-row" key={i.ID}><div className="mini-poster">{i.PosterURL?<img src={String(i.PosterURL)} alt=""/>:<Film/>}<Score value={i.Score}/></div><div className="watch-main"><div className="row-top"><div><h3>{i.Title}</h3><p>{i.Type} · {STATUS_LABELS[i.Status]||i.Status}</p></div><span className="progress-count">{p}{t?` / ${t}`:""}</span></div><div className="progress-track"><i style={{width:`${pct}%`}}/></div></div><div className="stepper"><button onClick={()=>onProgress(i,-1)}><Minus/></button><button className="plus" onClick={()=>onProgress(i,1)}><Plus/></button></div></div>})}</div>}

function FavoriteModal({close,notify,onChanged}:{close:()=>void;notify:(s:string)=>void;onChanged:()=>void}){const [state,setState]=useState<ApiState<MediaItem[]>>({loading:true,data:null,error:""});useEffect(()=>{api<MediaItem[]>("/api/library").then(d=>setState({loading:false,data:d,error:""})).catch(e=>setState({loading:false,data:null,error:e.message}))},[]);const candidates=(state.data||[]).filter(i=>!truthy(i.Favorite));const add=async(i:MediaItem)=>{try{await api(`/api/media/${i.ID}`,{method:"PATCH",body:JSON.stringify({action:"favorite",value:true})});notify("Añadido a favoritos");onChanged()}catch(e){notify(e instanceof Error?e.message:"Error")}};return <Modal title="Añadir favorito" close={close}>{state.loading?<LoadingBlock cards={2}/>:candidates.length?<div className="candidate-list">{candidates.map(i=><button key={i.ID} onClick={()=>add(i)}><span>{i.PosterURL?<img src={String(i.PosterURL)} alt=""/>:<Film/>}</span><div><b>{i.Title}</b><small>{i.Type} · {STATUS_LABELS[i.Status]||i.Status}</small></div><Plus/></button>)}</div>:<Empty>No hay más títulos disponibles.</Empty>}</Modal>}

function SearchView({notify,refreshHome,refreshLibrary}:{notify:(s:string)=>void;refreshHome:()=>void;refreshLibrary:()=>void}){
  const [q,setQ]=useState("");const [type,setType]=useState("All");const [results,setResults]=useState<SearchItem[]>([]);const [loading,setLoading]=useState(false);const [disc,setDisc]=useState<any>(null);const [err,setErr]=useState("");
  useEffect(()=>{api("/api/discovery").then(setDisc).catch(()=>{})},[]);
  const run=async()=>{if(!q.trim())return;setLoading(true);setErr("");try{setResults(await api<SearchItem[]>(`/api/search?q=${encodeURIComponent(q)}&type=${type}`))}catch(e){setErr(e instanceof Error?e.message:"Error")}finally{setLoading(false)}};
  return <><div className="page-title"><div className="eyebrow">DESCUBRIR</div><h1>Busca tu próxima historia</h1><p>Anime, películas y series en un solo lugar.</p></div><div className="search-box"><Search/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&run()} placeholder="Buscar anime, película o serie..."/><select value={type} onChange={e=>setType(e.target.value)}><option value="All">Todo</option><option value="Anime">Anime</option><option value="Movie">Películas</option><option value="Series">Series</option></select><button onClick={run}>Buscar</button></div>{loading?<LoadingBlock cards={6}/>:err?<ErrorBox message={err} onRetry={run}/>:results.length?<SearchGrid items={results} notify={notify} refreshHome={refreshHome} refreshLibrary={refreshLibrary}/>:<Discovery data={disc} notify={notify} refreshHome={refreshHome} refreshLibrary={refreshLibrary}/>}</>
}
function Discovery({data,...props}:{data:any;notify:(s:string)=>void;refreshHome:()=>void;refreshLibrary:()=>void}){if(!data)return <LoadingBlock cards={6}/>;return <><Section title="Lo nuevo de anime" subtitle="Tendencias en emisión"><SearchGrid items={data.anime||[]} {...props}/></Section><Section title="Películas y series ahora" subtitle="Estrenos y emisiones recientes"><SearchGrid items={data.moviesSeries||[]} {...props}/></Section></>}
function SearchGrid({items,notify,refreshHome,refreshLibrary}:{items:SearchItem[];notify:(s:string)=>void;refreshHome:()=>void;refreshLibrary:()=>void}){return <div className="search-grid">{items.map((i,idx)=><SearchCard key={`${i.source}-${i.externalId}-${idx}`} item={i} notify={notify} refreshHome={refreshHome} refreshLibrary={refreshLibrary}/>)}</div>}
function SearchCard({item,notify,refreshHome,refreshLibrary}:{item:SearchItem;notify:(s:string)=>void;refreshHome:()=>void;refreshLibrary:()=>void}){const [status,setStatus]=useState("Plan to Watch");const [busy,setBusy]=useState(false);const add=async()=>{setBusy(true);try{await api("/api/media",{method:"POST",body:JSON.stringify({item,status})});notify(item.inList?"Estado actualizado":"Añadido a tu lista");item.inList=true;item.existingStatus=status;await Promise.all([refreshHome(),refreshLibrary()])}catch(e){notify(e instanceof Error?e.message:"Error")}finally{setBusy(false)}};return <article className="search-card"> <div className="search-poster">{item.posterUrl?<img src={item.posterUrl} alt={item.title} loading="lazy"/>:<div className="poster-placeholder"><Film/></div>} {item.rating!==""&&<span className="rating"><Star size={11} fill="currentColor"/>{item.rating}</span>}</div><div className="search-copy"><div className="meta"><span>{item.type}</span>{item.year&&<span>· {item.year}</span>}</div><h3>{item.title}</h3>{item.inList?<div className="saved"><Check/> En tu lista · {STATUS_LABELS[item.existingStatus||""]||item.existingStatus}</div>:<><select value={status} onChange={e=>setStatus(e.target.value)}><option value="Plan to Watch">Próximo en ver</option><option value="Watching">Viendo ahora</option><option value="Completed">Ya la vi</option><option value="On Hold">En pausa</option><option value="Dropped">Abandonado</option></select><button className="primary-btn" disabled={busy} onClick={add}>{busy?"Guardando...":"Añadir"}</button></>}</div></article>}

function LibraryView({state,status,setStatus,type,setType,onRetry,onProgress,mutate,notify,refreshHome,setLibrary}:{state:ApiState<MediaItem[]>;status:string;setStatus:(s:string)=>void;type:string;setType:(s:string)=>void;onRetry:()=>void;onProgress:(i:MediaItem,d:1|-1)=>void;mutate:(id:string,body:any,opt?:Partial<MediaItem>)=>Promise<MediaItem>;notify:(s:string)=>void;refreshHome:()=>void;setLibrary:React.Dispatch<React.SetStateAction<ApiState<MediaItem[]>>>}){
  const [edit,setEdit]=useState<MediaItem|null>(null);const items=useMemo(()=>{let a=state.data||[];if(status)a=a.filter(i=>i.Status===status);if(type)a=a.filter(i=>i.Type===type);return [...a].sort((a,b)=>String(b.UpdatedAt||"").localeCompare(String(a.UpdatedAt||"")))},[state.data,status,type]);
  if(state.loading&&!state.data)return <LoadingBlock cards={7}/>;if(state.error&&!state.data)return <ErrorBox message={state.error} onRetry={onRetry}/>;
  const del=async(i:MediaItem)=>{if(!confirm(`¿Eliminar “${i.Title}” de tu lista?`))return;try{await api(`/api/media/${i.ID}`,{method:"DELETE"});setLibrary(s=>s.data?{...s,data:s.data.filter(x=>String(x.ID)!==String(i.ID))}:s);await refreshHome();notify("Eliminado de tu lista")}catch(e){notify(e instanceof Error?e.message:"Error")}};
  const fav=async(i:MediaItem)=>{try{await mutate(String(i.ID),{action:"favorite",value:!truthy(i.Favorite)},{Favorite:!truthy(i.Favorite)});notify(!truthy(i.Favorite)?"Añadido a favoritos":"Quitado de favoritos")}catch{}};
  const track=async(i:MediaItem)=>{const plan=i.Status==="Plan to Watch";const current=plan?truthy(i.TrackPlanNews):truthy(i.TrackUpdates);try{await mutate(String(i.ID),{action:"tracking",mode:plan?"plan":"watching"},{[plan?"TrackPlanNews":"TrackUpdates"]:!current});notify(!current?"Seguimiento activado":"Seguimiento desactivado")}catch{}};
  return <><div className="page-title"><div className="eyebrow">TU COLECCIÓN</div><h1>Mi lista</h1><p>{state.data?.length||0} títulos guardados.</p></div><div className="filter-bar"><select value={type} onChange={e=>setType(e.target.value)}><option value="">Todos los tipos</option><option value="Anime">Anime</option><option value="Movie">Películas</option><option value="Series">Series</option></select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos los estados</option><option value="Watching">Viendo</option><option value="Completed">Ya la vi</option><option value="Plan to Watch">Próximo en ver</option><option value="On Hold">En pausa</option><option value="Dropped">Abandonado</option></select></div>{items.length?<div className="library-list">{items.map(i=><div className="library-row" key={i.ID}><div className="lib-poster">{i.PosterURL?<img src={String(i.PosterURL)} alt=""/>:<Film/>}<Score value={i.Score}/></div><div className="lib-main"><div className="lib-title-line"><div><h3>{i.Title}</h3><p>{i.Type} · {STATUS_LABELS[i.Status]||i.Status}</p></div><span>{num(i.Progress)}{num(i.Total)?` / ${num(i.Total)}`:""}</span></div><div className="progress-track"><i style={{width:`${num(i.Total)?Math.min(100,num(i.Progress)/num(i.Total)*100):0}%`}}/></div><div className="lib-actions"><button onClick={()=>fav(i)} className={truthy(i.Favorite)?"on":""}><Heart size={16} fill={truthy(i.Favorite)?"currentColor":"none"}/></button>{(i.Type==="Anime"||i.Type==="Series")&&(i.Status==="Watching"||i.Status==="Plan to Watch")&&<button onClick={()=>track(i)} className={(i.Status==="Plan to Watch"?truthy(i.TrackPlanNews):truthy(i.TrackUpdates))?"on":""}><Bell size={16}/></button>}<button onClick={()=>setEdit(i)}><Pencil size={16}/></button><button className="danger" onClick={()=>del(i)}><Trash2 size={16}/></button></div></div><div className="stepper"><button onClick={()=>onProgress(i,-1)}><Minus/></button><button className="plus" onClick={()=>onProgress(i,1)}><Plus/></button></div></div>)}</div>:<Empty>No hay títulos con estos filtros.</Empty>}{edit&&<EditModal item={edit} close={()=>setEdit(null)} onSave={async(changes)=>{try{await mutate(String(edit.ID),changes);notify("Cambios guardados");setEdit(null)}catch{}}}/>}</>
}
function EditModal({item,close,onSave}:{item:MediaItem;close:()=>void;onSave:(v:any)=>void}){const [status,setStatus]=useState(String(item.Status));const [progress,setProgress]=useState(String(item.Progress||0));const [score,setScore]=useState(String(item.Score||""));return <Modal title={`Editar · ${item.Title}`} close={close}><div className="form-stack"><label>Estado<select value={status} onChange={e=>setStatus(e.target.value)}><option value="Plan to Watch">Próximo en ver</option><option value="Watching">Viendo ahora</option><option value="Completed">Ya la vi</option><option value="On Hold">En pausa</option><option value="Dropped">Abandonado</option></select></label><label>Progreso<input type="number" min="0" value={progress} onChange={e=>setProgress(e.target.value)}/></label><label>Score 1–10<input type="number" min="1" max="10" value={score} onChange={e=>setScore(e.target.value)}/></label><button className="primary-btn" onClick={()=>onSave({Status:status,Progress:progress,Score:score})}>Guardar cambios</button></div></Modal>}

function UpdatesView({state,onRetry}:{state:ApiState<any>;onRetry:()=>void}){if(state.loading&&!state.data)return <LoadingBlock cards={5}/>;if(state.error&&!state.data)return <ErrorBox message={state.error} onRetry={onRetry}/>;const d=state.data||{calendar:[],planNews:[],trackedWatchingCount:0,trackedPlanCount:0};return <><div className="page-title"><div className="eyebrow">SEGUIMIENTO</div><h1>Novedades</h1><p>Próximos episodios, temporadas y fechas para lo que tú elegiste seguir.</p></div><div className="updates-summary"><div><Bell/><strong>{d.trackedWatchingCount}</strong><span>Viendo en seguimiento</span></div><div><Sparkles/><strong>{d.trackedPlanCount}</strong><span>Próximos con novedades</span></div></div><Section title="Calendario de próximos episodios" subtitle="Solo títulos con 🔔 activada"><UpdateList items={d.calendar}/></Section><Section title="Próximos en ver: temporadas y novedades" subtitle="Solo títulos con seguimiento activado"><UpdateList items={d.planNews}/></Section></>}
function UpdateList({items}:{items:UpdateItem[]}){if(!items?.length)return <Empty>No hay novedades disponibles para los títulos seleccionados.</Empty>;return <div className="update-list">{items.map((i,idx)=><article key={`${i.id}-${idx}`} className="update-card"><div className="update-poster">{i.posterUrl?<img src={i.posterUrl} alt=""/>:<Film/>}</div><div><div className="update-kicker">{i.dateKind==="exact"?"CONFIRMADO":i.dateKind==="approx"?"FECHA APROXIMADA":"SIN FECHA"}</div><h3>{i.title}</h3><p>{i.label||i.message}</p><div className="update-date"><Clock3 size={16}/>{i.airingAt?formatDate(i.airingAt):(i.approxDateText||"Información no disponible")}</div></div></article>)}</div>}

function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){return <div className="modal-backdrop" onMouseDown={e=>e.currentTarget===e.target&&close()}><div className="modal"><div className="modal-head"><h2>{title}</h2><button onClick={close}><X/></button></div>{children}</div></div>}
