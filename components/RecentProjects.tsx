import React from 'react';
import { projects } from "@/data";
import ProjectShelf from "@/components/ui/project-shelf";

const RecentProjects = () => {
    return (
        <section className="py-20" id="projects">
            <h1 className="heading scroll-m-20 text-4xl font-bold tracking-tight lg:text-5xl">
                A small selection of{" "}
                <span className="text-purple">recent projects</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-white-200/70">
                Chaque projet est rangé comme un livre. Cliquez une tranche pour la faire pivoter,
                la couverture pour ouvrir le projet.
            </p>

            <div className="mt-10">
                <ProjectShelf items={projects}/>
            </div>
        </section>
    );
};

export default RecentProjects;
