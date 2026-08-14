export default function Header({step}:{step?:string}){return <header className="px-5 pt-6 pb-3"><div className="brand">ChainDose</div>{step&&<div className="sub">{step}</div>}</header>}
