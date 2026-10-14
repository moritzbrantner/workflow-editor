import ts from "typescript";
// The compiler's real standard-library declarations are bundled for offline browser checking.
import library0 from "typescript/lib/lib.decorators.d.ts?raw";
import library1 from "typescript/lib/lib.decorators.legacy.d.ts?raw";
import library2 from "typescript/lib/lib.dom.asynciterable.d.ts?raw";
import library3 from "typescript/lib/lib.dom.d.ts?raw";
import library4 from "typescript/lib/lib.dom.iterable.d.ts?raw";
import library5 from "typescript/lib/lib.es2015.collection.d.ts?raw";
import library6 from "typescript/lib/lib.es2015.core.d.ts?raw";
import library7 from "typescript/lib/lib.es2015.d.ts?raw";
import library8 from "typescript/lib/lib.es2015.generator.d.ts?raw";
import library9 from "typescript/lib/lib.es2015.iterable.d.ts?raw";
import library10 from "typescript/lib/lib.es2015.promise.d.ts?raw";
import library11 from "typescript/lib/lib.es2015.proxy.d.ts?raw";
import library12 from "typescript/lib/lib.es2015.reflect.d.ts?raw";
import library13 from "typescript/lib/lib.es2015.symbol.d.ts?raw";
import library14 from "typescript/lib/lib.es2015.symbol.wellknown.d.ts?raw";
import library15 from "typescript/lib/lib.es2016.array.include.d.ts?raw";
import library16 from "typescript/lib/lib.es2016.d.ts?raw";
import library17 from "typescript/lib/lib.es2016.intl.d.ts?raw";
import library18 from "typescript/lib/lib.es2017.arraybuffer.d.ts?raw";
import library19 from "typescript/lib/lib.es2017.d.ts?raw";
import library20 from "typescript/lib/lib.es2017.date.d.ts?raw";
import library21 from "typescript/lib/lib.es2017.intl.d.ts?raw";
import library22 from "typescript/lib/lib.es2017.object.d.ts?raw";
import library23 from "typescript/lib/lib.es2017.sharedmemory.d.ts?raw";
import library24 from "typescript/lib/lib.es2017.string.d.ts?raw";
import library25 from "typescript/lib/lib.es2017.typedarrays.d.ts?raw";
import library26 from "typescript/lib/lib.es2018.asyncgenerator.d.ts?raw";
import library27 from "typescript/lib/lib.es2018.asynciterable.d.ts?raw";
import library28 from "typescript/lib/lib.es2018.d.ts?raw";
import library29 from "typescript/lib/lib.es2018.intl.d.ts?raw";
import library30 from "typescript/lib/lib.es2018.promise.d.ts?raw";
import library31 from "typescript/lib/lib.es2018.regexp.d.ts?raw";
import library32 from "typescript/lib/lib.es2019.array.d.ts?raw";
import library33 from "typescript/lib/lib.es2019.d.ts?raw";
import library34 from "typescript/lib/lib.es2019.intl.d.ts?raw";
import library35 from "typescript/lib/lib.es2019.object.d.ts?raw";
import library36 from "typescript/lib/lib.es2019.string.d.ts?raw";
import library37 from "typescript/lib/lib.es2019.symbol.d.ts?raw";
import library38 from "typescript/lib/lib.es2020.bigint.d.ts?raw";
import library39 from "typescript/lib/lib.es2020.d.ts?raw";
import library40 from "typescript/lib/lib.es2020.date.d.ts?raw";
import library41 from "typescript/lib/lib.es2020.intl.d.ts?raw";
import library42 from "typescript/lib/lib.es2020.number.d.ts?raw";
import library43 from "typescript/lib/lib.es2020.promise.d.ts?raw";
import library44 from "typescript/lib/lib.es2020.sharedmemory.d.ts?raw";
import library45 from "typescript/lib/lib.es2020.string.d.ts?raw";
import library46 from "typescript/lib/lib.es2020.symbol.wellknown.d.ts?raw";
import library47 from "typescript/lib/lib.es2021.d.ts?raw";
import library48 from "typescript/lib/lib.es2021.intl.d.ts?raw";
import library49 from "typescript/lib/lib.es2021.promise.d.ts?raw";
import library50 from "typescript/lib/lib.es2021.string.d.ts?raw";
import library51 from "typescript/lib/lib.es2021.weakref.d.ts?raw";
import library52 from "typescript/lib/lib.es2022.array.d.ts?raw";
import library53 from "typescript/lib/lib.es2022.d.ts?raw";
import library54 from "typescript/lib/lib.es2022.error.d.ts?raw";
import library55 from "typescript/lib/lib.es2022.full.d.ts?raw";
import library56 from "typescript/lib/lib.es2022.intl.d.ts?raw";
import library57 from "typescript/lib/lib.es2022.object.d.ts?raw";
import library58 from "typescript/lib/lib.es2022.regexp.d.ts?raw";
import library59 from "typescript/lib/lib.es2022.string.d.ts?raw";
import library60 from "typescript/lib/lib.es5.d.ts?raw";
import library61 from "typescript/lib/lib.scripthost.d.ts?raw";
import library62 from "typescript/lib/lib.webworker.importscripts.d.ts?raw";
export const workflowTypeLibraries = new Map([
  ["/lib.decorators.d.ts", library0],
  ["/lib.decorators.legacy.d.ts", library1],
  ["/lib.dom.asynciterable.d.ts", library2],
  ["/lib.dom.d.ts", library3],
  ["/lib.dom.iterable.d.ts", library4],
  ["/lib.es2015.collection.d.ts", library5],
  ["/lib.es2015.core.d.ts", library6],
  ["/lib.es2015.d.ts", library7],
  ["/lib.es2015.generator.d.ts", library8],
  ["/lib.es2015.iterable.d.ts", library9],
  ["/lib.es2015.promise.d.ts", library10],
  ["/lib.es2015.proxy.d.ts", library11],
  ["/lib.es2015.reflect.d.ts", library12],
  ["/lib.es2015.symbol.d.ts", library13],
  ["/lib.es2015.symbol.wellknown.d.ts", library14],
  ["/lib.es2016.array.include.d.ts", library15],
  ["/lib.es2016.d.ts", library16],
  ["/lib.es2016.intl.d.ts", library17],
  ["/lib.es2017.arraybuffer.d.ts", library18],
  ["/lib.es2017.d.ts", library19],
  ["/lib.es2017.date.d.ts", library20],
  ["/lib.es2017.intl.d.ts", library21],
  ["/lib.es2017.object.d.ts", library22],
  ["/lib.es2017.sharedmemory.d.ts", library23],
  ["/lib.es2017.string.d.ts", library24],
  ["/lib.es2017.typedarrays.d.ts", library25],
  ["/lib.es2018.asyncgenerator.d.ts", library26],
  ["/lib.es2018.asynciterable.d.ts", library27],
  ["/lib.es2018.d.ts", library28],
  ["/lib.es2018.intl.d.ts", library29],
  ["/lib.es2018.promise.d.ts", library30],
  ["/lib.es2018.regexp.d.ts", library31],
  ["/lib.es2019.array.d.ts", library32],
  ["/lib.es2019.d.ts", library33],
  ["/lib.es2019.intl.d.ts", library34],
  ["/lib.es2019.object.d.ts", library35],
  ["/lib.es2019.string.d.ts", library36],
  ["/lib.es2019.symbol.d.ts", library37],
  ["/lib.es2020.bigint.d.ts", library38],
  ["/lib.es2020.d.ts", library39],
  ["/lib.es2020.date.d.ts", library40],
  ["/lib.es2020.intl.d.ts", library41],
  ["/lib.es2020.number.d.ts", library42],
  ["/lib.es2020.promise.d.ts", library43],
  ["/lib.es2020.sharedmemory.d.ts", library44],
  ["/lib.es2020.string.d.ts", library45],
  ["/lib.es2020.symbol.wellknown.d.ts", library46],
  ["/lib.es2021.d.ts", library47],
  ["/lib.es2021.intl.d.ts", library48],
  ["/lib.es2021.promise.d.ts", library49],
  ["/lib.es2021.string.d.ts", library50],
  ["/lib.es2021.weakref.d.ts", library51],
  ["/lib.es2022.array.d.ts", library52],
  ["/lib.es2022.d.ts", library53],
  ["/lib.es2022.error.d.ts", library54],
  ["/lib.es2022.full.d.ts", library55],
  ["/lib.es2022.intl.d.ts", library56],
  ["/lib.es2022.object.d.ts", library57],
  ["/lib.es2022.regexp.d.ts", library58],
  ["/lib.es2022.string.d.ts", library59],
  ["/lib.es5.d.ts", library60],
  ["/lib.scripthost.d.ts", library61],
  ["/lib.webworker.importscripts.d.ts", library62],
]);

export const workflowTypeLibraryFiles = new Map(
  [...workflowTypeLibraries].map(([name, source]) => [
    name,
    ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true),
  ]),
);
export const workflowStandardTypeNames = new Set(
  [...workflowTypeLibraryFiles.values()].flatMap((file) =>
    file.statements.flatMap((statement) => {
      if (
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isModuleDeclaration(statement)
      ) {
        return statement.name && ts.isIdentifier(statement.name) ? [statement.name.text] : [];
      }
      return [];
    }),
  ),
);
