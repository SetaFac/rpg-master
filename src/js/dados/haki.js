const HAKI_DATA = {
  "obs": [
    {"key":"t0","label":"Identificar Emoções","group":"Inexperiente","custo":1,"req":""},
    {"key":"t1","label":"Perceber Presença","group":"Inexperiente","custo":1,"req":""},
    {"key":"t2","label":"Senso de Desafio","group":"Inexperiente","custo":1,"req":"Identificar Emoções"},
    {"key":"t3","label":"Antevisão","group":"Inexperiente","custo":3,"req":""},
    {"key":"t4","label":"Previsão","group":"Inexperiente","custo":2,"req":""},
    {"key":"t5","label":"Percepção Ágil","group":"Inexperiente","custo":2,"req":"Previsão"},
    {"key":"t6","label":"Clarividência","group":"Inexperiente","custo":2,"req":"Iden. Emoç | Perc. Pres"},
    {"key":"t7","label":"Antecipação","group":"Treinado","custo":2,"req":"Perceber Presença"},
    {"key":"t8","label":"Antevisão Sobrenatural","group":"Treinado","custo":2,"req":"Antevisão Dominada"},
    {"key":"t9","label":"Previsão Nobrenatural","group":"Treinado","custo":2,"req":"Previsão Dominada"},
    {"key":"t10","label":"Vidente","group":"Treinado","custo":2,"req":"Antevisão e Previsão"},
    {"key":"t11","label":"Premonição","group":"Treinado","custo":2,"req":"Clarividência Dominada"},
    {"key":"t12","label":"Ímpeto Antecipado","group":"Treinado","custo":3,"req":"Ante. Sobre | Anteci."},
    {"key":"t13","label":"Ver o Futuro","group":"Perito","custo":5,"req":"Premonição e Vidente"},
    {"key":"t14","label":"Antevisão Especial","group":"Perito","custo":5,"req":"Antevi Sobre | Anteci"},
    {"key":"t15","label":"Previsão Especial","group":"Perito","custo":5,"req":"Pre Sob. | Per | Iden Emo."}
  ],
  "arm": [
    {"key":"t0","label":"Ataque Infuso","group":"Inexperiente","custo":1,"req":""},
    {"key":"t1","label":"Fortalecimento","group":"Inexperiente","custo":1,"req":"Ataque Infuso"},
    {"key":"t2","label":"Endurecimento Defensivo","group":"Inexperiente","custo":2,"req":""},
    {"key":"t3","label":"Endurecimento Ofensivo","group":"Inexperiente","custo":2,"req":"Ata. Infuso | Fortale."},
    {"key":"t4","label":"Potencialização","group":"Inexperiente","custo":3,"req":"Fortalecimento"},
    {"key":"t5","label":"Haki Ígneo","group":"Treinado","custo":2,"req":"End. Ofen. Dom. | Poten."},
    {"key":"t6","label":"Escudo de Vontade","group":"Treinado","custo":3,"req":"End. Def. Dominado"},
    {"key":"t7","label":"Emissão de Haki","group":"Treinado","custo":3,"req":"Ata. Inf. Dom | End Of. Do."},
    {"key":"t8","label":"Emissão Defensiva","group":"Treinado","custo":2,"req":"End. Def. Dom. | Emi. Haki"},
    {"key":"t9","label":"Defesa Suprema","group":"Treinado","custo":3,"req":"End. Def. Dominado"},
    {"key":"t10","label":"Escudo Ágil","group":"Perito","custo":5,"req":"Escudo de Vontade Avan."},
    {"key":"t11","label":"Destruição Interna","group":"Perito","custo":5,"req":"Emissão de Haki"},
    {"key":"t12","label":"Armadura Suprema","group":"Perito","custo":5,"req":"End. Def. Ava. | Def. Sup."}
  ],
  "rei": [
    {"key":"t0","label":"Rei","group":"Inexperiente","custo":0,"req":""},
    {"key":"t1","label":"Autoridade do Rei","group":"Treinado","custo":3,"req":""},
    {"key":"t2","label":"Soberania do Rei","group":"Treinado","custo":3,"req":""},
    {"key":"t3","label":"Imposição do Rei","group":"Treinado","custo":3,"req":""},
    {"key":"t4","label":"Vontade do Rei","group":"Treinado","custo":3,"req":""},
    {"key":"t5","label":"Espírito Vigoroso","group":"Treinado","custo":3,"req":""},
    {"key":"t6","label":"Armamento do Rei","group":"Perito","custo":5,"req":""},
    {"key":"t7","label":"Presença Esmagadora","group":"Perito","custo":5,"req":""},
    {"key":"t8","label":"Emissão de Autoridade","group":"Perito","custo":5,"req":""}
  ]
};
