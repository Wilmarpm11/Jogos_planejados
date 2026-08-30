# Massa estrutural teórica neutra da Lotofácil

**Versão:** 1.0.0  
**Story de origem:** 2.4  
**Escopo:** distribuição exata das faixas estruturais para apostas simples de 15 dezenas.

## Semântica

`calculateLotofacilStructuralMass` enumera `C(25,15)` sem amostragem. Para
cada combinação, ele usa o MetricEngine, o StructuralClassifier e o resumo
estrutural canônicos; não reimplementa E1–E10 nem incorpora sinais auxiliares
de ocupação.

A saída contém cinco bandas mutuamente exclusivas, contagens inteiras e
frequências reduzidas como `ExactFraction`. A versão do algoritmo identifica a
semântica usada para consolidar o universo.

## Fronteiras

A massa é neutra e descritiva: não estima a chance de prêmio, não autoriza
rejeitar jogos e não contém histórico, lift, estratégia, geração ou cobertura.

Ela é válida somente para `betSize: 15`. Apostas de 16–20 precisam de massa
calculada e versionada no próprio universo; a referência de 15 nunca é
transferida entre tamanhos.

## Reutilização

`@boloes/combinatorics` fornece a enumeração reutilizável de índices em ordem
crescente. O contrato compartilhado de `StructuralMassProfile` estabiliza a
forma serializável do resultado, enquanto a semântica das bandas permanece no
módulo Lotofácil.
