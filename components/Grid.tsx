import React from 'react';
import {BentoGrid, BentoGridItem} from "@/components/ui/bento-grid";
import {gridItems} from "@/data";

const Grid = () => {
    return (
        <div id="about" >
            <BentoGrid>
                {
 gridItems.map
                    (({id,title,description,className,img,imgClassName,titleClassName,spareImg})=>(
                        <BentoGridItem
                        id={id}
                        key={id}
                        title={title}
                        description={description}
                        className={className}
                        img={img}
                        titleClassName={titleClassName}
                        spareImg={spareImg}
                        />
                    ))
                }
            </BentoGrid>
        </div>
    );
};

export default Grid;