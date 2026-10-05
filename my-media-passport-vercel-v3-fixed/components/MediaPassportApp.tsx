"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Check, ChevronLeft, ChevronRight, Clock3, Film, Heart, Home, Library, Minus, Pencil, Play, Plus, Search, Sparkles, Star, Trash2, X } from "lucide-react";
import type { DetailSeed, HomeData, MediaDetails, MediaItem, SearchItem, UpdateItem } from "@/lib/types";
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
function detailFromMedia(item:MediaItem):DetailSeed{const type=String(item.Type||"");const source=type==="Anime"&&item.AniListID?"AniList":(type==="Movie"||type==="Series")&&item.TMDbID?"TMDb":String(item.Source||"");const externalId=source==="AniList"?String(item.AniListID||item.ExternalID||""):source==="TMDb"?String(item.TMDbID||item.ExternalID||""):String(item.ExternalID||"");return {title:String(item.Title||"Sin título"),type,source,externalId,year:item.Year||"",posterUrl:String(item.PosterURL||""),backdropUrl:String(item.BackdropURL||""),overview:String(item.Overview||""),libraryId:String(item.ID||""),status:String(item.Status||""),progress:item.Progress,total:item.Total,score:item.Score};}
function detailFromSearch(item:SearchItem):DetailSeed{return {title:item.title,type:item.type,source:item.source,externalId:item.externalId,year:item.year,posterUrl:item.posterUrl,backdropUrl:item.backdropUrl,overview:item.overview,rating:item.rating,voteCount:item.voteCount,libraryId:item.existingId,status:item.existingStatus,progress:item.existingProgress,total:item.existingTotal,score:item.existingScore};}

export default function MediaPassportApp(){
  const [view,setView]=useState<View>("home");
  const [home,setHome]=useState<ApiState<HomeData>>({loading:true,data:null,error:""});
  const [library,setLibrary]=useState<ApiState<MediaItem[]>>({loading:false,data:null,error:""});
  const [updates,setUpdates]=useState<ApiState<any>>({loading:false,data:null,error:""});
  const [toast,setToast]=useState("");
  const [libraryStatus,setLibraryStatus]=useState("");
  const [libraryType,setLibraryType]=useState("");
  const [detailSeed,setDetailSeed]=useState<DetailSeed|null>(null);

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
  const openMediaDetails=(item:MediaItem)=>setDetailSeed(detailFromMedia(item));
  const openSearchDetails=(item:SearchItem)=>setDetailSeed(detailFromSearch(item));

  return <div className="app-shell">
    <Ambient/>
    <header className="topbar"><div className="brand"><span className="brand-mark">M</span><span>media</span><b>passport</b></div><div className="desktop-nav"><NavButtons view={view} setView={navigate}/></div></header>
    <main className="main-wrap">
      <div key={view} className="view-enter">
        {view==="home"&&<HomeView state={home} onRetry={loadHome} onFilter={openFiltered} onViewLibrary={()=>navigate("library")} onProgress={changeProgress} notify={notify} refreshLibrary={()=>loadLibrary(true)} onOpenDetails={openMediaDetails}/>} 
        {view==="search"&&<SearchView notify={notify} refreshHome={loadHome} refreshLibrary={()=>loadLibrary(true)} onOpenDetails={openSearchDetails}/>} 
        {view==="library"&&<LibraryView state={library} status={libraryStatus} setStatus={setLibraryStatus} type={libraryType} setType={setLibraryType} onRetry={()=>loadLibrary(true)} onProgress={changeProgress} mutate={mutate} notify={notify} refreshHome={loadHome} setLibrary={setLibrary} onOpenDetails={openMediaDetails}/>} 
        {view==="updates"&&<UpdatesView state={updates} onRetry={()=>loadUpdates(true)}/>} 
      </div>
    </main>
    <nav className="bottom-nav"><NavButtons view={view} setView={navigate} mobile/></nav>
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
    {detailSeed&&<MediaDetailSheet seed={detailSeed} close={()=>setDetailSeed(null)}/>}
  </div>
}

function Ambient(){return <><div className="orb orb-a"/><div className="orb orb-b"/><div className="noise"/></>}
function NavButtons({view,setView,mobile=false}:{view:View;setView:(v:View)=>void;mobile?:boolean}){const items:[View,string,any][]=[["home","Inicio",Home],["search","Buscar",Search],["library","Mi lista",Library],["updates","Novedades",Bell]];return <>{items.map(([v,label,Icon])=><button key={v} className={`nav-btn ${view===v?"active":""}`} onClick={()=>setView(v)}><Icon size={mobile?21:16}/><span>{label}</span></button>)}</>}

function LoadingBlock({cards=4}:{cards?:number}){return <div className="skeleton-grid">{Array.from({length:cards}).map((_,i)=><div className="skeleton-card" key={i}><div className="sk poster"/><div className="sk line lg"/><div className="sk line"/></div>)}</div>}
function ErrorBox({message,onRetry}:{message:string;onRetry:()=>void}){return <div className="state-box"><div className="state-icon">!</div><h3>No pudimos cargar esta información</h3><p>{message}</p><button className="primary-btn" onClick={onRetry}>Reintentar</button></div>}
function Empty({children}:{children:React.ReactNode}){return <div className="empty-box">{children}</div>}

function HomeView({state,onRetry,onFilter,onViewLibrary,onProgress,notify,refreshLibrary,onOpenDetails}:{state:ApiState<HomeData>;onRetry:()=>void;onFilter:(s:string)=>void;onViewLibrary:()=>void;onProgress:(i:MediaItem,d:1|-1)=>void;notify:(s:string)=>void;refreshLibrary:()=>void;onOpenDetails:(i:MediaItem)=>void}){
  const [favOpen,setFavOpen]=useState(false);
  const [editingFavorites,setEditingFavorites]=useState(false);
  const [favItems,setFavItems]=useState<MediaItem[]>([]);
  const data=state.data||emptyHome;

  useEffect(()=>{setFavItems(data.favorites||[])},[state.data]);

  if(state.loading&&!state.data)return <><HeroSkeleton/><LoadingBlock/></>;
  if(state.error&&!state.data)return <ErrorBox message={state.error} onRetry={onRetry}/>;

  const p=data.profile;
  const displayName=(!p?.Username||["Tu nombre","Your name"].includes(String(p.Username).trim()))?"DK08":p.Username;
  const displayHandle=(!p?.Handle||["@tuusuario","@youruser"].includes(String(p.Handle).trim().toLowerCase()))?"@dk08":p.Handle;

  const removeFavorite=async(item:MediaItem)=>{
    const before=favItems;
    setFavItems(current=>current.filter(x=>String(x.ID)!==String(item.ID)));
    try{
      await api(`/api/media/${item.ID}`,{method:"PATCH",body:JSON.stringify({action:"favorite",value:false})});
      notify("Quitado del Top 5");
      await Promise.all([onRetry(),refreshLibrary()]);
    }catch(e){
      setFavItems(before);
      notify(e instanceof Error?e.message:"No pudimos quitarlo");
    }
  };

  const moveFavorite=async(index:number,direction:-1|1)=>{
    const target=index+direction;
    if(target<0||target>=favItems.length)return;
    const before=[...favItems];
    const next=[...favItems];
    [next[index],next[target]]=[next[target],next[index]];
    setFavItems(next);
    try{
      await api("/api/favorites/reorder",{method:"POST",body:JSON.stringify({ids:next.map(i=>String(i.ID))})});
      notify(`Top ${index+1} movido a Top ${target+1}`);
      await onRetry();
    }catch(e){
      setFavItems(before);
      notify(e instanceof Error?e.message:"No pudimos reordenar");
    }
  };

  return <>
    <section className="profile-hero">
      <div className="hero-glow"/><div className="profile-line"><div className="avatar">{p?.AvatarURL?<img src={p.AvatarURL} alt="Avatar"/>:<span>{String(displayName).slice(0,2).toUpperCase()}</span>}</div><div><div className="eyebrow">MY MEDIA PASSPORT</div><h1>{displayName}</h1><p className="handle">{displayHandle}</p></div></div>
      <div className="stats-grid"><Stat n={data.total} label="Total" onClick={()=>onFilter("")}/><Stat n={data.counts.Watching||0} label="Viendo" onClick={()=>onFilter("Watching")}/><Stat n={data.counts.Completed||0} label="Ya la vi" onClick={()=>onFilter("Completed")}/><Stat n={data.counts["Plan to Watch"]||0} label="Próximo" onClick={()=>onFilter("Plan to Watch")}/><Stat n={data.counts["On Hold"]||0} label="En pausa" onClick={()=>onFilter("On Hold")}/><Stat n={data.counts.Dropped||0} label="Abandonado" onClick={()=>onFilter("Dropped")}/></div>
    </section>

    <Section
      title="Mis favoritos"
      subtitle="Tu top 5 personal"
      action={<div className="top5-actions">
        {favItems.length<5&&<button className="ghost-btn" onClick={()=>setFavOpen(true)}><Plus size={16}/> Añadir</button>}
        {favItems.length>0&&<button className={`ghost-btn ${editingFavorites?"active":""}`} onClick={()=>setEditingFavorites(v=>!v)}>{editingFavorites?<Check size={16}/>:<Pencil size={16}/>} {editingFavorites?"Listo":"Editar Top 5"}</button>}
      </div>}
    >
      <Favorites items={favItems} onAdd={()=>setFavOpen(true)} editing={editingFavorites} onRemove={removeFavorite} onMove={moveFavorite} onOpenDetails={onOpenDetails}/>
    </Section>

    <Section title="Agregados recientemente" subtitle="Tus últimas incorporaciones" action={<button className="text-btn" onClick={onViewLibrary}>Ver lista <ChevronRight size={15}/></button>}><PosterGrid items={data.recent} onOpenDetails={onOpenDetails}/></Section>
    <Section title="Viendo ahora" subtitle="Continúa donde lo dejaste"><WatchingList items={data.watching} onProgress={onProgress} onOpenDetails={onOpenDetails}/></Section>

    {favOpen&&<FavoriteModal close={()=>setFavOpen(false)} notify={notify} onChanged={async()=>{await Promise.all([onRetry(),refreshLibrary()])}}/>}
  </>
}
function HeroSkeleton(){return <div className="profile-hero"><div className="profile-line"><div className="sk round"/><div className="grow"><div className="sk line sm"/><div className="sk line xl"/><div className="sk line sm"/></div></div><div className="stats-grid">{Array.from({length:6}).map((_,i)=><div className="stat-card" key={i}><div className="sk line lg"/><div className="sk line"/></div>)}</div></div>}
function Stat({n,label,onClick}:{n:number;label:string;onClick:()=>void}){return <button className="stat-card" onClick={onClick}><strong>{n}</strong><span>{label}</span></button>}
function Section({title,subtitle,action,children}:{title:string;subtitle?:string;action?:React.ReactNode;children:React.ReactNode}){return <section className="section"><div className="section-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>{children}</section>}
function Score({value}:{value:unknown}){if(value===""||value===undefined||value===null)return null;return <span className="score"><Star size={11} fill="currentColor"/>{String(value)}</span>}
function Poster({item,className="",onOpenDetails}:{item:MediaItem;className?:string;onOpenDetails?:(i:MediaItem)=>void}){return <button type="button" className={`poster-card ${className} ${onOpenDetails?"detail-clickable":""}`} onClick={()=>onOpenDetails?.(item)} aria-label={`Ver detalles de ${String(item.Title||"este título")}`}>{item.PosterURL?<img src={String(item.PosterURL)} alt={String(item.Title||"Poster")} loading="lazy"/>:<div className="poster-placeholder"><Film/></div>}<Score value={item.Score}/><div className="poster-gradient"/><div className="poster-copy"><b>{item.Title}</b><span>{item.Type} {item.Year?`· ${item.Year}`:""}</span></div></button>}

function Favorites({items,onAdd,editing,onRemove,onMove,onOpenDetails}:{items:MediaItem[];onAdd:()=>void;editing:boolean;onRemove:(i:MediaItem)=>void;onMove:(index:number,direction:-1|1)=>void;onOpenDetails:(i:MediaItem)=>void}){
  const slots=[0,1,2,3,4];
  return <div className={`favorites-grid ${editing?"is-editing":""}`}>
    {slots.map((i)=>{
      const item=items[i];
      if(!item)return <button key={`empty-${i}`} className={`favorite-slot favorite-empty favorite-pos-${i+1}`} onClick={onAdd}><span className="favorite-rank">#{i+1}</span><Plus/><span>Añadir favorito</span></button>;
      return <div className={`favorite-slot favorite-pos-${i+1}`} key={String(item.ID)}>
        <Poster item={item} className={i===0?"favorite-big":""} onOpenDetails={onOpenDetails}/>
        <span className="favorite-rank">#{i+1}</span>
        {editing&&<div className="favorite-tools">
          <button aria-label="Mover hacia arriba" disabled={i===0} onClick={()=>onMove(i,-1)}><ChevronLeft size={16}/></button>
          <button aria-label="Mover hacia abajo" disabled={i===items.length-1} onClick={()=>onMove(i,1)}><ChevronRight size={16}/></button>
          <button className="remove" aria-label="Quitar de favoritos" onClick={()=>onRemove(item)}><X size={16}/></button>
        </div>}
      </div>
    })}
  </div>
}

function PosterGrid({items,onOpenDetails}:{items:MediaItem[];onOpenDetails:(i:MediaItem)=>void}){return items.length?<div className="poster-grid">{items.map(i=><Poster key={i.ID} item={i} onOpenDetails={onOpenDetails}/>)}</div>:<Empty>Aún no hay títulos recientes.</Empty>}

function WatchingList({items,onProgress,onOpenDetails}:{items:MediaItem[];onProgress:(i:MediaItem,d:1|-1)=>void;onOpenDetails:(i:MediaItem)=>void}){
  if(!items.length)return <Empty>No tienes títulos en “Viendo” ahora.</Empty>;
  return <div className="watch-list">{items.map(i=>{
    const p=num(i.Progress),t=num(i.Total),pct=t?Math.min(100,p/t*100):0;
    return <div className="watch-row" key={i.ID}>
      <button type="button" className="mini-poster detail-reset detail-clickable" onClick={()=>onOpenDetails(i)} aria-label={`Ver detalles de ${String(i.Title||"este título")}`}>{i.PosterURL?<img src={String(i.PosterURL)} alt={String(i.Title||"")}/>:<Film/>}<Score value={i.Score}/></button>
      <button type="button" className="watch-main detail-reset watch-detail-trigger" onClick={()=>onOpenDetails(i)}>
        <h3 className="watch-title" title={String(i.Title||"")}>{i.Title}</h3>
        <div className="watch-meta"><span>{i.Type} · {STATUS_LABELS[i.Status]||i.Status}</span><strong>{p}{t?` / ${t}`:""}</strong></div>
        <div className="progress-track"><i style={{width:`${pct}%`}}/></div>
      </button>
      <div className="stepper">
        <button aria-label="Restar episodio" onClick={()=>onProgress(i,-1)}><Minus/></button>
        <button aria-label="Sumar episodio" className="plus" onClick={()=>onProgress(i,1)}><Plus/></button>
      </div>
    </div>
  })}</div>
}

function FavoriteModal({close,notify,onChanged}:{close:()=>void;notify:(s:string)=>void;onChanged:()=>Promise<void>|void}){
  const [state,setState]=useState<ApiState<MediaItem[]>>({loading:true,data:null,error:""});
  useEffect(()=>{api<MediaItem[]>("/api/library").then(d=>setState({loading:false,data:d,error:""})).catch(e=>setState({loading:false,data:null,error:e.message}))},[]);
  const favorites=(state.data||[]).filter(i=>truthy(i.Favorite));
  const candidates=(state.data||[]).filter(i=>!truthy(i.Favorite));
  const add=async(i:MediaItem)=>{
    if(favorites.length>=5){notify("Tu Top 5 ya está completo");return}
    try{
      await api(`/api/media/${i.ID}`,{method:"PATCH",body:JSON.stringify({action:"favorite",value:true})});
      setState(s=>s.data?{...s,data:s.data.map(x=>String(x.ID)===String(i.ID)?{...x,Favorite:true}:x)}:s);
      notify("Añadido a tu Top 5");
      await onChanged();
    }catch(e){notify(e instanceof Error?e.message:"Error")}
  };
  return <Modal title="Añadir al Top 5" close={close}>
    <p className="modal-helper">{favorites.length}/5 favoritos seleccionados. Puedes ordenarlos desde “Editar Top 5”.</p>
    {state.loading?<LoadingBlock cards={2}/>:favorites.length>=5?<Empty>Tu Top 5 está completo. Cierra esta ventana y usa “Editar Top 5” para quitar o reordenar.</Empty>:candidates.length?<div className="candidate-list">{candidates.map(i=><button key={i.ID} onClick={()=>add(i)}><span>{i.PosterURL?<img src={String(i.PosterURL)} alt=""/>:<Film/>}</span><div><b>{i.Title}</b><small>{i.Type} · {STATUS_LABELS[i.Status]||i.Status}</small></div><Plus/></button>)}</div>:<Empty>No hay más títulos disponibles.</Empty>}
  </Modal>
}

function SearchView({notify,refreshHome,refreshLibrary,onOpenDetails}:{notify:(s:string)=>void;refreshHome:()=>void;refreshLibrary:()=>void;onOpenDetails:(i:SearchItem)=>void}){
  const [q,setQ]=useState("");const [type,setType]=useState("All");const [results,setResults]=useState<SearchItem[]>([]);const [loading,setLoading]=useState(false);const [disc,setDisc]=useState<any>(null);const [err,setErr]=useState("");
  useEffect(()=>{api("/api/discovery").then(setDisc).catch(()=>{})},[]);
  const run=async()=>{if(!q.trim())return;setLoading(true);setErr("");try{setResults(await api<SearchItem[]>(`/api/search?q=${encodeURIComponent(q)}&type=${type}`))}catch(e){setErr(e instanceof Error?e.message:"Error")}finally{setLoading(false)}};
  return <><div className="page-title"><div className="eyebrow">DESCUBRIR</div><h1>Busca tu próxima historia</h1><p>Anime, películas y series en un solo lugar.</p></div><div className="search-box"><Search/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&run()} placeholder="Buscar anime, película o serie..."/><select value={type} onChange={e=>setType(e.target.value)}><option value="All">Todo</option><option value="Anime">Anime</option><option value="Movie">Películas</option><option value="Series">Series</option></select><button onClick={run}>Buscar</button></div>{loading?<LoadingBlock cards={6}/>:err?<ErrorBox message={err} onRetry={run}/>:results.length?<SearchGrid items={results} notify={notify} refreshHome={refreshHome} refreshLibrary={refreshLibrary} onOpenDetails={onOpenDetails}/>:<Discovery data={disc} notify={notify} refreshHome={refreshHome} refreshLibrary={refreshLibrary} onOpenDetails={onOpenDetails}/>}</>
}
function Discovery({data,...props}:{data:any;notify:(s:string)=>void;refreshHome:()=>void;refreshLibrary:()=>void;onOpenDetails:(i:SearchItem)=>void}){if(!data)return <LoadingBlock cards={6}/>;return <><Section title="Lo nuevo de anime" subtitle="Tendencias en emisión"><SearchGrid items={data.anime||[]} {...props}/></Section><Section title="Películas y series ahora" subtitle="Estrenos y emisiones recientes"><SearchGrid items={data.moviesSeries||[]} {...props}/></Section></>}
function SearchGrid({items,notify,refreshHome,refreshLibrary,onOpenDetails}:{items:SearchItem[];notify:(s:string)=>void;refreshHome:()=>void;refreshLibrary:()=>void;onOpenDetails:(i:SearchItem)=>void}){return <div className="search-grid">{items.map((i,idx)=><SearchCard key={`${i.source}-${i.externalId}-${idx}`} item={i} notify={notify} refreshHome={refreshHome} refreshLibrary={refreshLibrary} onOpenDetails={onOpenDetails}/>)}</div>}
function SearchCard({item,notify,refreshHome,refreshLibrary,onOpenDetails}:{item:SearchItem;notify:(s:string)=>void;refreshHome:()=>void;refreshLibrary:()=>void;onOpenDetails:(i:SearchItem)=>void}){const [status,setStatus]=useState("Plan to Watch");const [busy,setBusy]=useState(false);const add=async()=>{setBusy(true);try{await api("/api/media",{method:"POST",body:JSON.stringify({item,status})});notify(item.inList?"Estado actualizado":"Añadido a tu lista");item.inList=true;item.existingStatus=status;await Promise.all([refreshHome(),refreshLibrary()])}catch(e){notify(e instanceof Error?e.message:"Error")}finally{setBusy(false)}};return <article className="search-card"> <button type="button" className="search-poster detail-reset detail-clickable" onClick={()=>onOpenDetails(item)} aria-label={`Ver detalles de ${item.title}`}>{item.posterUrl?<img src={item.posterUrl} alt={item.title} loading="lazy"/>:<div className="poster-placeholder"><Film/></div>} {item.rating!==""&&<span className="rating"><Star size={11} fill="currentColor"/>{item.rating}</span>}<span className="details-hint"><Play size={13}/> Ver ficha</span></button><div className="search-copy"><div className="meta"><span>{item.type}</span>{item.year&&<span>· {item.year}</span>}</div><button type="button" className="search-title-button" onClick={()=>onOpenDetails(item)}><h3>{item.title}</h3></button>{item.inList?<div className="saved"><Check/> En tu lista · {STATUS_LABELS[item.existingStatus||""]||item.existingStatus}</div>:<><select value={status} onChange={e=>setStatus(e.target.value)}><option value="Plan to Watch">Próximo en ver</option><option value="Watching">Viendo ahora</option><option value="Completed">Ya la vi</option><option value="On Hold">En pausa</option><option value="Dropped">Abandonado</option></select><button className="primary-btn" disabled={busy} onClick={add}>{busy?"Guardando...":"Añadir"}</button></>}</div></article>}

function LibraryView({state,status,setStatus,type,setType,onRetry,onProgress,mutate,notify,refreshHome,setLibrary,onOpenDetails}:{state:ApiState<MediaItem[]>;status:string;setStatus:(s:string)=>void;type:string;setType:(s:string)=>void;onRetry:()=>void;onProgress:(i:MediaItem,d:1|-1)=>void;mutate:(id:string,body:any,opt?:Partial<MediaItem>)=>Promise<MediaItem>;notify:(s:string)=>void;refreshHome:()=>void;setLibrary:React.Dispatch<React.SetStateAction<ApiState<MediaItem[]>>>;onOpenDetails:(i:MediaItem)=>void}){
  const [edit,setEdit]=useState<MediaItem|null>(null);const items=useMemo(()=>{let a=state.data||[];if(status)a=a.filter(i=>i.Status===status);if(type)a=a.filter(i=>i.Type===type);return [...a].sort((a,b)=>String(b.UpdatedAt||"").localeCompare(String(a.UpdatedAt||"")))},[state.data,status,type]);
  if(state.loading&&!state.data)return <LoadingBlock cards={7}/>;if(state.error&&!state.data)return <ErrorBox message={state.error} onRetry={onRetry}/>;
  const del=async(i:MediaItem)=>{if(!confirm(`¿Eliminar “${i.Title}” de tu lista?`))return;try{await api(`/api/media/${i.ID}`,{method:"DELETE"});setLibrary(s=>s.data?{...s,data:s.data.filter(x=>String(x.ID)!==String(i.ID))}:s);await refreshHome();notify("Eliminado de tu lista")}catch(e){notify(e instanceof Error?e.message:"Error")}};
  const fav=async(i:MediaItem)=>{try{await mutate(String(i.ID),{action:"favorite",value:!truthy(i.Favorite)},{Favorite:!truthy(i.Favorite)});notify(!truthy(i.Favorite)?"Añadido a favoritos":"Quitado de favoritos")}catch{}};
  const track=async(i:MediaItem)=>{const plan=i.Status==="Plan to Watch";const current=plan?truthy(i.TrackPlanNews):truthy(i.TrackUpdates);try{await mutate(String(i.ID),{action:"tracking",mode:plan?"plan":"watching"},{[plan?"TrackPlanNews":"TrackUpdates"]:!current});notify(!current?"Seguimiento activado":"Seguimiento desactivado")}catch{}};
  return <><div className="page-title"><div className="eyebrow">TU COLECCIÓN</div><h1>Mi lista</h1><p>{state.data?.length||0} títulos guardados.</p></div><div className="filter-bar"><select value={type} onChange={e=>setType(e.target.value)}><option value="">Todos los tipos</option><option value="Anime">Anime</option><option value="Movie">Películas</option><option value="Series">Series</option></select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos los estados</option><option value="Watching">Viendo</option><option value="Completed">Ya la vi</option><option value="Plan to Watch">Próximo en ver</option><option value="On Hold">En pausa</option><option value="Dropped">Abandonado</option></select></div>{items.length?<div className="library-list">{items.map(i=><div className="library-row" key={i.ID}><button type="button" className="lib-poster detail-reset detail-clickable" onClick={()=>onOpenDetails(i)} aria-label={`Ver detalles de ${String(i.Title||"este título")}`}>{i.PosterURL?<img src={String(i.PosterURL)} alt=""/>:<Film/>}<Score value={i.Score}/></button><div className="lib-main"><button type="button" className="lib-detail-head" onClick={()=>onOpenDetails(i)}><div className="lib-title-line"><div><h3>{i.Title}</h3><p>{i.Type} · {STATUS_LABELS[i.Status]||i.Status}</p></div><span>{num(i.Progress)}{num(i.Total)?` / ${num(i.Total)}`:""}</span></div><div className="progress-track"><i style={{width:`${num(i.Total)?Math.min(100,num(i.Progress)/num(i.Total)*100):0}%`}}/></div></button><div className="lib-actions"><button onClick={()=>fav(i)} className={truthy(i.Favorite)?"on":""}><Heart size={16} fill={truthy(i.Favorite)?"currentColor":"none"}/></button>{(i.Type==="Anime"||i.Type==="Series")&&(i.Status==="Watching"||i.Status==="Plan to Watch")&&<button onClick={()=>track(i)} className={(i.Status==="Plan to Watch"?truthy(i.TrackPlanNews):truthy(i.TrackUpdates))?"on":""}><Bell size={16}/></button>}<button onClick={()=>setEdit(i)}><Pencil size={16}/></button><button className="danger" onClick={()=>del(i)}><Trash2 size={16}/></button></div></div><div className="stepper"><button onClick={()=>onProgress(i,-1)}><Minus/></button><button className="plus" onClick={()=>onProgress(i,1)}><Plus/></button></div></div>)}</div>:<Empty>No hay títulos con estos filtros.</Empty>}{edit&&<EditModal item={edit} close={()=>setEdit(null)} onSave={async(changes)=>{try{await mutate(String(edit.ID),changes);notify("Cambios guardados");setEdit(null)}catch{}}}/>}</>
}
function EditModal({item,close,onSave}:{item:MediaItem;close:()=>void;onSave:(v:any)=>void}){const [status,setStatus]=useState(String(item.Status));const [progress,setProgress]=useState(String(item.Progress||0));const [score,setScore]=useState(String(item.Score||""));return <Modal title={`Editar · ${item.Title}`} close={close}><div className="form-stack"><label>Estado<select value={status} onChange={e=>setStatus(e.target.value)}><option value="Plan to Watch">Próximo en ver</option><option value="Watching">Viendo ahora</option><option value="Completed">Ya la vi</option><option value="On Hold">En pausa</option><option value="Dropped">Abandonado</option></select></label><label>Progreso<input type="number" min="0" value={progress} onChange={e=>setProgress(e.target.value)}/></label><label>Score 1–10<input type="number" min="1" max="10" value={score} onChange={e=>setScore(e.target.value)}/></label><button className="primary-btn" onClick={()=>onSave({Status:status,Progress:progress,Score:score})}>Guardar cambios</button></div></Modal>}

function UpdatesView({state,onRetry}:{state:ApiState<any>;onRetry:()=>void}){if(state.loading&&!state.data)return <LoadingBlock cards={5}/>;if(state.error&&!state.data)return <ErrorBox message={state.error} onRetry={onRetry}/>;const d=state.data||{calendar:[],planNews:[],trackedWatchingCount:0,trackedPlanCount:0};return <><div className="page-title"><div className="eyebrow">SEGUIMIENTO</div><h1>Novedades</h1><p>Próximos episodios, temporadas y fechas para lo que tú elegiste seguir.</p></div><div className="updates-summary"><div><Bell/><strong>{d.trackedWatchingCount}</strong><span>Viendo en seguimiento</span></div><div><Sparkles/><strong>{d.trackedPlanCount}</strong><span>Próximos con novedades</span></div></div><Section title="Calendario de próximos episodios" subtitle="Solo títulos con 🔔 activada"><UpdateList items={d.calendar}/></Section><Section title="Próximos en ver: temporadas y novedades" subtitle="Solo títulos con seguimiento activado"><UpdateList items={d.planNews}/></Section></>}
function UpdateList({items}:{items:UpdateItem[]}){if(!items?.length)return <Empty>No hay novedades disponibles para los títulos seleccionados.</Empty>;return <div className="update-list">{items.map((i,idx)=><article key={`${i.id}-${idx}`} className="update-card"><div className="update-poster">{i.posterUrl?<img src={i.posterUrl} alt=""/>:<Film/>}</div><div><div className="update-kicker">{i.dateKind==="exact"?"CONFIRMADO":i.dateKind==="approx"?"FECHA APROXIMADA":"SIN FECHA"}</div><h3>{i.title}</h3><p>{i.label||i.message}</p><div className="update-date"><Clock3 size={16}/>{i.airingAt?formatDate(i.airingAt):(i.approxDateText||"Información no disponible")}</div></div></article>)}</div>}

function MediaDetailSheet({seed,close}:{seed:DetailSeed;close:()=>void}){
  const [state,setState]=useState<ApiState<MediaDetails>>({loading:true,data:null,error:""});
  useEffect(()=>{
    const previous=document.body.style.overflow;document.body.style.overflow="hidden";
    const controller=new AbortController();
    const supported=(seed.source==="AniList"||seed.source==="TMDb")&&Boolean(seed.externalId);
    if(!supported){setState({loading:false,data:null,error:""});return()=>{document.body.style.overflow=previous;controller.abort()};}
    const url=`/api/details?source=${encodeURIComponent(seed.source)}&id=${encodeURIComponent(seed.externalId)}&type=${encodeURIComponent(seed.type)}`;
    fetch(url,{signal:controller.signal}).then(async res=>{const json=await res.json().catch(()=>({}));if(!res.ok)throw new Error(json.error||"No pudimos cargar los detalles.");return json as MediaDetails;}).then(data=>setState({loading:false,data,error:""})).catch(e=>{if(e?.name!=="AbortError")setState({loading:false,data:null,error:e instanceof Error?e.message:""})});
    return()=>{document.body.style.overflow=previous;controller.abort()};
  },[seed]);

  const d=state.data;
  const title=d?.title||seed.title||"Sin título";
  const overview=d?.overview||seed.overview||"Información no disponible.";
  const poster=d?.posterUrl||seed.posterUrl||"";
  const backdrop=d?.backdropUrl||seed.backdropUrl||poster;
  const year=d?.year||seed.year||"";
  const rating=d?.rating||seed.rating||"";
  const genres=d?.genres||[];
  const trailer=d?.trailer||null;
  const runtime=d?.runtime;
  const episodes=d?.episodes||seed.total;
  const trailerUrl=trailer?.key?`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?rel=0&modestbranding=1`:"";

  return <div className="detail-backdrop" onMouseDown={e=>e.currentTarget===e.target&&close()}>
    <section className="detail-sheet" role="dialog" aria-modal="true" aria-label={`Detalles de ${title}`}>
      <div className="detail-hero" style={backdrop?{backgroundImage:`linear-gradient(180deg,rgba(2,8,6,.12),rgba(2,8,6,.98)),url(${backdrop})`}:undefined}>
        <button className="detail-close" onClick={close} aria-label="Cerrar"><X/></button>
        <div className="detail-hero-content">
          <div className="detail-cover">{poster?<img src={poster} alt={`Poster de ${title}`}/>:<Film/>}</div>
          <div className="detail-copy">
            <div className="eyebrow">{seed.type||d?.type||"MEDIA"}</div>
            <h2>{title}</h2>
            <div className="detail-chips">{year&&<span>{year}</span>}{rating!==""&&<span><Star size={13} fill="currentColor"/>{rating}</span>}{runtime&&<span>{runtime} min</span>}{episodes&&<span>{episodes} {Number(episodes)===1?"episodio":"episodios"}</span>}</div>
            {genres.length>0&&<div className="detail-genres">{genres.slice(0,4).map(g=><span key={g}>{g}</span>)}</div>}
          </div>
        </div>
      </div>
      <div className="detail-body">
        <div className="detail-section"><div className="detail-section-title">Descripción</div><p className="detail-overview">{overview}</p></div>
        {seed.libraryId&&<div className="detail-library-info"><div><span>Estado</span><strong>{STATUS_LABELS[String(seed.status||"")]||seed.status||"Información no disponible"}</strong></div><div><span>Progreso</span><strong>{num(seed.progress)}{num(seed.total)?` / ${num(seed.total)}`:""}</strong></div><div><span>Tu score</span><strong>{seed.score!==""&&seed.score!==undefined?`${seed.score} ★`:"Sin score"}</strong></div></div>}
        <div className="detail-section">
          <div className="detail-section-title"><Play size={17} fill="currentColor"/> Trailer</div>
          {state.loading?<div className="trailer-skeleton"><div className="sk"/></div>:trailerUrl?<div className="trailer-frame"><iframe src={trailerUrl} title={trailer?.name||`Trailer de ${title}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></div>:<div className="trailer-empty"><Play size={28}/><strong>Trailer no disponible</strong><span>La fuente no tiene un trailer de YouTube asociado a este título.</span></div>}
          {state.error&&<p className="detail-note">No pudimos consultar información adicional ahora. La descripción guardada sigue disponible.</p>}
        </div>
      </div>
    </section>
  </div>
}

function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){return <div className="modal-backdrop" onMouseDown={e=>e.currentTarget===e.target&&close()}><div className="modal"><div className="modal-head"><h2>{title}</h2><button onClick={close}><X/></button></div>{children}</div></div>}
