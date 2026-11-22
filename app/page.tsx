import {FloatingNav} from "@/components/ui/floating-navbar";
import Hero from "@/components/Hero";
import Grid from "@/components/Grid";
import RecentProjects from "@/components/RecentProjects";
import {navItems} from "@/data";
import Client from "@/components/Client";
import Experience from "@/components/Experience";
import Approach from "@/components/Approach";
import Footer from "@/components/Footer";
import StarField from "@/components/ui/star-field";
import GameHud from "@/components/ui/game-hud";
import {LevelTitle, Reveal} from "@/components/ui/level-title";

export const revalidate = 60;

const levels = [
    {id: "top", name: "Départ"},
    {id: "about", name: "Profil"},
    {id: "projects", name: "Projets"},
    {id: "testimonials", name: "Avis"},
    {id: "experience", name: "Parcours"},
    {id: "approach", name: "Méthode"},
    {id: "contact", name: "Contact"},
];

export default function Home() {
  return (
    <>
      <StarField/>
      <GameHud levels={levels}/>
      <main className="relative z-10 flex justify-center items-center flex-col overflow-hidden mx-auto sm:px-10 px-5">
        <div className="max-w-7xl w-full text-center">
            <FloatingNav navItems={navItems}/>

            <Hero/>

            <LevelTitle n={2} name="Profil"/>
            <Reveal><Grid/></Reveal>

            <LevelTitle n={3} name="Projets"/>
            <RecentProjects/>

            <LevelTitle n={4} name="Avis clients"/>
            <Client/>

            <LevelTitle n={5} name="Parcours"/>
            <Reveal><div id="experience"><Experience/></div></Reveal>

            <LevelTitle n={6} name="Méthode"/>
            <Reveal><div id="approach"><Approach/></div></Reveal>

            <LevelTitle n={7} name="Boss final : le contact"/>
            <Footer/>
        </div>
      </main>
    </>
  );
}
