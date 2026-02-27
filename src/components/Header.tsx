import { Link } from '@tanstack/react-router'

import './Header.css'

export default function Header() {
  return (
    <header className="header">
      <nav className="nav">
        <div className="nav-item">
          <Link to="/">Home</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to={"/demo/start/server-funcs" as "/"}>Start - Server Functions</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to={"/demo/start/api-request" as "/"}>Start - API Request</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to={"/demo/start/ssr" as "/"}>Start - SSR Demos</Link>
        </div>
      </nav>
    </header>
  )
}
