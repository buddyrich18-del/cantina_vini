// Schede offline gratuite: profili tipici per denominazione / vitigno / stile.
// Chiavi senza accenti e minuscole; l'elenco va dal più specifico al più generico: vince la prima voce che corrisponde.
const e = (keys, identita, vista, naso, bocca, abbinamenti, servizio, eta) => ({ keys, identita, vista, naso, bocca, abbinamenti, servizio, eta });

const KB = [
  e(['barolo'], 'Barolo (Piemonte, Langhe): 100% Nebbiolo, rosso di grande struttura e longevità.', 'Rosso granato, tende all’aranciato con l’età.', 'Rosa appassita, viola, ciliegia, catrame, liquirizia, spezie, sottobosco.', 'Corpo pieno, tannino fitto, acidità alta, finale lungo e austero.', ['Brasato', 'Tajarin al tartufo', 'Selvaggina', 'Formaggi stagionati', 'Arrosti di manzo'], '16–18 °C; decantare 1–2 ore.', [8, 30]),
  e(['barbaresco'], 'Barbaresco (Piemonte): 100% Nebbiolo, più elegante e meno severo del Barolo.', 'Rosso granato brillante.', 'Rosa, frutti rossi, spezie dolci, sottobosco, liquirizia.', 'Pieno ma fine, tannino setoso, acidità vivace.', ['Carni rosse', 'Risotto al tartufo', 'Brasati', 'Formaggi stagionati'], '16–18 °C; decantare circa 1 ora.', [6, 20]),
  e(['nebbiolo', 'langhe', 'roero'], 'Nebbiolo (Piemonte): rosso di buona struttura, tannico e profumato.', 'Rosso rubino-granato, trasparente.', 'Rosa, ciliegia, viola, spezie, note terrose.', 'Tannino marcato, acidità alta, medio-pieno.', ['Carni brasate', 'Funghi', 'Agnolotti', 'Formaggi di media stagionatura'], '16–18 °C.', [3, 12]),
  e(['barbera'], 'Barbera (Piemonte): rosso vivace, di poco tannino e molta acidità.', 'Rosso rubino intenso, quasi violaceo.', 'Ciliegia, prugna, viola, spezie, a volte vaniglia dal legno.', 'Acidità spiccata, tannino morbido, corpo medio-pieno.', ['Salumi', 'Pasta al ragù', 'Pizza', 'Carni alla griglia'], '14–16 °C.', [2, 8]),
  e(['dolcetto'], 'Dolcetto (Piemonte): rosso di tutti i giorni, fruttato e asciutto.', 'Rosso rubino viola.', 'Ciliegia, mandorla amara, prugna, viola.', 'Tannino piacevolmente amarotico, acidità bassa, corpo medio.', ['Antipasti piemontesi', 'Pasta con sughi di carne', 'Salumi'], '14–16 °C.', [1, 4]),
  e(['brunello'], 'Brunello di Montalcino (Toscana): 100% Sangiovese, rosso strutturato e longevo.', 'Rosso granato intenso.', 'Ciliegia matura, cuoio, tabacco, spezie, sottobosco, note balsamiche.', 'Pieno, tannino solido ma maturo, acidità sostenuta, lungo.', ['Bistecca alla fiorentina', 'Pappardelle al cinghiale', 'Formaggi stagionati', 'Arrosti'], '16–18 °C; decantare 1 ora.', [7, 25]),
  e(['chianti classico', 'gran selezione'], 'Chianti Classico (Toscana): Sangiovese prevalente, rosso secco e sapido.', 'Rosso rubino, granato con l’età.', 'Ciliegia, viola, spezie, terra, tabacco.', 'Acidità vivace, tannino fine, medio corpo, sapido.', ['Bistecca', 'Pasta al ragù', 'Salumi toscani', 'Pecorino'], '16–17 °C.', [3, 12]),
  e(['chianti'], 'Chianti (Toscana): Sangiovese, rosso fresco e versatile.', 'Rosso rubino.', 'Ciliegia, viola, note speziate leggere.', 'Fresco, tannino medio, facile da bere.', ['Pizza', 'Pasta al pomodoro', 'Carni grigliate', 'Salumi'], '15–17 °C.', [1, 6]),
  e(['nobile di montepulciano', 'vino nobile'], 'Vino Nobile di Montepulciano (Toscana): Sangiovese (Prugnolo Gentile), elegante e strutturato.', 'Rosso rubino-granato.', 'Ciliegia, prugna, violetta, spezie, cuoio.', 'Tannino fine, buona acidità, medio-pieno.', ['Arrosti', 'Pici al ragù', 'Formaggi stagionati'], '16–18 °C.', [4, 15]),
  e(['morellino'], 'Morellino di Scansano (Maremma toscana): Sangiovese solare e fruttato.', 'Rosso rubino vivo.', 'Ciliegia, frutti di bosco, spezie, macchia mediterranea.', 'Morbido, tannino medio, finale sapido.', ['Grigliate', 'Pasta al cinghiale', 'Formaggi'], '16 °C.', [2, 7]),
  e(['bolgheri', 'sassicaia', 'ornellaia', 'tignanello', 'supertuscan'], 'Rosso toscano da uve bordolesi (Cabernet, Merlot) o blend con Sangiovese, di grande struttura.', 'Rosso rubino profondo.', 'Frutti neri, cassis, tabacco, spezie, grafite, note balsamiche.', 'Pieno, tannino fitto ma elegante, lungo.', ['Carni rosse', 'Agnello', 'Selvaggina', 'Formaggi stagionati'], '17–18 °C; decantare 1 ora.', [6, 25]),
  e(['sangiovese'], 'Sangiovese: rosso italiano per eccellenza, secco e sapido.', 'Rosso rubino.', 'Ciliegia, viola, spezie, note terrose.', 'Acidità alta, tannino medio, sapido.', ['Pasta al ragù', 'Carni arrosto', 'Pizza'], '16 °C.', [2, 10]),
  e(['amarone'], 'Amarone della Valpolicella (Veneto): da uve appassite (Corvina), rosso potente e secco.', 'Rosso granato intenso.', 'Ciliegia sotto spirito, prugna secca, cioccolato, spezie, tabacco.', 'Pieno, caldo (15–16% vol.), morbido, tannino levigato, lunghissimo.', ['Brasati', 'Formaggi molto stagionati', 'Selvaggina', 'Cioccolato fondente'], '17–18 °C; decantare 1–2 ore.', [8, 25]),
  e(['ripasso'], 'Valpolicella Ripasso (Veneto): Corvina rifermentata sulle bucce dell’Amarone, via di mezzo fra Valpolicella e Amarone.', 'Rosso rubino intenso.', 'Ciliegia matura, spezie, cacao, note di frutta secca.', 'Corpo pieno, morbido, tannino medio.', ['Risotto all’Amarone', 'Carni rosse', 'Formaggi'], '16–17 °C.', [3, 10]),
  e(['valpolicella'], 'Valpolicella (Veneto): rosso da Corvina, fresco e fruttato.', 'Rosso rubino brillante.', 'Ciliegia, amarena, spezie delicate.', 'Fresco, tannino leggero, corpo medio.', ['Pasta al ragù', 'Salumi', 'Pizza', 'Carni bianche'], '14–16 °C.', [1, 5]),
  e(['bardolino'], 'Bardolino (Veneto, Lago di Garda): rosso leggero e profumato.', 'Rosso rubino chiaro.', 'Fragola, ciliegia, pepe bianco.', 'Leggero, fresco, poco tannico.', ['Antipasti', 'Pesce di lago', 'Carni bianche', 'Pizza'], '12–14 °C.', [1, 3]),
  e(['montepulciano d abruzzo', 'montepulciano d\'abruzzo', 'montepulciano'], 'Montepulciano d’Abruzzo: rosso rotondo e generoso, diffuso e conviviale.', 'Rosso rubino violaceo.', 'Prugna, ciliegia nera, spezie, liquirizia.', 'Morbido, tannino vellutato, corpo medio-pieno.', ['Arrosticini', 'Pasta al ragù', 'Salumi', 'Formaggi'], '16–18 °C.', [1, 6]),
  e(['primitivo', 'manduria'], 'Primitivo (Puglia): rosso caldo, ricco e morbido.', 'Rosso rubino profondo.', 'Prugna, confettura di frutti neri, spezie, cacao.', 'Alcolico, morbido, tannino rotondo, poca acidità.', ['Carni grigliate', 'Orecchiette al ragù', 'Formaggi saporiti'], '16–18 °C.', [1, 6]),
  e(['negroamaro', 'salice salentino'], 'Negroamaro (Salento, Puglia): rosso morbido con note scure e terrose.', 'Rosso rubino intenso.', 'Prugna, mora, tabacco, spezie, liquirizia.', 'Medio-pieno, tannino morbido, leggermente amarognolo.', ['Carni arrosto', 'Pasta al forno', 'Formaggi'], '16–18 °C.', [1, 6]),
  e(['nero d avola', 'nero d\'avola'], 'Nero d’Avola (Sicilia): rosso solare di buon corpo.', 'Rosso rubino intenso.', 'Prugna, ciliegia nera, spezie, pepe, cioccolato.', 'Corpo pieno, tannino morbido, buona acidità.', ['Carni alla griglia', 'Pasta alla norma', 'Formaggi'], '16–18 °C.', [1, 7]),
  e(['etna'], 'Etna (Sicilia): vini vulcanici; il rosso (Nerello Mascalese) è fine e minerale, il bianco (Carricante) sapido.', 'Rosso rubino chiaro, oppure giallo paglierino.', 'Rosso: ciliegia, rosa, pepe, note di cenere. Bianco: agrumi, fiori bianchi, pietra focaia.', 'Rosso: tannino fine, acidità alta. Bianco: fresco, sapido, minerale.', ['Rosso: carni, funghi, pasta al forno', 'Bianco: pesce, crostacei, verdure'], 'Rosso 15–16 °C; bianco 10–12 °C.', [2, 10]),
  e(['aglianico', 'taurasi'], 'Aglianico / Taurasi (Campania): rosso di carattere, tannico e longevo.', 'Rosso rubino-granato intenso.', 'Amarena, prugna, spezie, cuoio, tabacco, note terrose.', 'Pieno, tannino deciso, acidità alta, lungo.', ['Carni brasate', 'Agnello', 'Formaggi stagionati'], '17–18 °C; decantare 1 ora.', [5, 20]),
  e(['cannonau'], 'Cannonau (Sardegna): Grenache sardo, rosso caldo e speziato.', 'Rosso rubino-granato.', 'Ciliegia, frutti rossi, erbe mediterranee, spezie.', 'Caldo, morbido, tannino medio.', ['Porceddu', 'Formaggi sardi', 'Salumi', 'Carni arrosto'], '16–18 °C.', [2, 8]),
  e(['lambrusco'], 'Lambrusco (Emilia): rosso frizzante, secco o amabile.', 'Rosso violaceo con spuma rosata.', 'Fragola, ciliegia, viola.', 'Frizzante, fresco, leggero tannino.', ['Salumi', 'Tortellini', 'Cotechino', 'Parmigiano'], '10–12 °C.', [0, 2]),
  e(['pinot nero', 'pinot noir', 'blauburgunder'], 'Pinot Nero: rosso elegante e delicato (Alto Adige, Oltrepò, Borgogna).', 'Rosso rubino scarico.', 'Fragola, lampone, viola, sottobosco, spezie fini.', 'Medio corpo, tannino sottile, acidità fresca.', ['Anatra', 'Funghi', 'Salmone', 'Carni bianche', 'Formaggi delicati'], '14–16 °C.', [2, 10]),
  e(['merlot'], 'Merlot: rosso morbido e rotondo.', 'Rosso rubino.', 'Prugna, ciliegia, cioccolato, erbe.', 'Morbido, tannino levigato, corpo medio-pieno.', ['Carni rosse', 'Pasta al ragù', 'Formaggi'], '16–18 °C.', [2, 8]),
  e(['cabernet'], 'Cabernet (Sauvignon / Franc): rosso strutturato, di tannino marcato.', 'Rosso rubino intenso.', 'Cassis, peperone verde, mora, spezie, cedro.', 'Corpo pieno, tannino fitto, lungo.', ['Bistecca', 'Agnello', 'Formaggi stagionati'], '16–18 °C.', [3, 15]),
  e(['syrah', 'shiraz'], 'Syrah / Shiraz: rosso speziato e potente.', 'Rosso viola scuro.', 'Mora, pepe nero, violetta, note affumicate.', 'Pieno, tannino setoso, caldo.', ['Carni speziate', 'Barbecue', 'Selvaggina'], '16–18 °C.', [2, 10]),
  e(['refosco'], 'Refosco dal Peduncolo Rosso (Friuli): rosso scuro, vinoso e sapido.', 'Rosso rubino violaceo.', 'Prugna, mora, spezie, erbe.', 'Tannino deciso, acidità alta, finale amarognolo.', ['Salumi friulani', 'Carni alla brace', 'Formaggi saporiti'], '16 °C.', [2, 8]),
  e(['soave'], 'Soave (Veneto): bianco da Garganega, fresco e delicato.', 'Giallo paglierino.', 'Fiori bianchi, mandorla, pera, agrumi.', 'Fresco, sapido, finale di mandorla.', ['Pesce', 'Risotti', 'Antipasti', 'Verdure'], '8–10 °C.', [1, 5]),
  e(['lugana'], 'Lugana (Garda): bianco da Turbiana, sapido e di buon corpo.', 'Giallo paglierino con riflessi verdi.', 'Fiori bianchi, agrumi, mandorla, frutta a polpa bianca.', 'Fresco, sapido, medio corpo.', ['Pesce di lago', 'Risotti', 'Antipasti', 'Carni bianche'], '8–10 °C.', [1, 5]),
  e(['pinot grigio', 'pinot gris'], 'Pinot Grigio: bianco secco, secondo la zona più o meno ricco.', 'Giallo paglierino, a volte ramato.', 'Pera, mela, fiori bianchi, mandorla.', 'Fresco, medio corpo, finale morbido.', ['Antipasti', 'Pesce', 'Formaggi freschi', 'Verdure'], '8–10 °C.', [1, 3]),
  e(['prosecco'], 'Prosecco (Veneto/Friuli): spumante da Glera, fresco e fruttato.', 'Giallo paglierino, perlage fine.', 'Mela, pera, fiori bianchi, agrumi.', 'Fresco, leggero, bollicina cremosa, dosaggio brut o extra dry.', ['Aperitivo', 'Crudi di pesce', 'Fritti', 'Antipasti'], '6–8 °C.', [0, 2]),
  e(['franciacorta', 'trento doc', 'trentodoc', 'metodo classico', 'champagne'], 'Spumante Metodo Classico (rifermentato in bottiglia): complesso e fine.', 'Giallo paglierino, perlage fine e persistente.', 'Crosta di pane, lievito, mela, agrumi, mandorla.', 'Secco, cremoso, acidità viva, lungo.', ['Aperitivo', 'Crudi', 'Crostacei', 'Fritture', 'Piatti ricchi'], '6–8 °C.', [2, 10]),
  e(['spumante', 'brut'], 'Spumante secco: vino con bollicine, fresco.', 'Giallo paglierino, perlage.', 'Frutta bianca, fiori, note di crosta di pane.', 'Fresco, bollicina vivace.', ['Aperitivo', 'Antipasti', 'Fritti'], '6–8 °C.', [0, 3]),
  e(['verdicchio'], 'Verdicchio (Marche): bianco con acidità alta e finale di mandorla.', 'Giallo paglierino con riflessi verdi.', 'Fiori bianchi, agrumi, erbe, mandorla amara.', 'Fresco, sapido, buona struttura.', ['Pesce alla griglia', 'Brodetto', 'Pasta ai frutti di mare'], '8–10 °C.', [1, 8]),
  e(['vermentino'], 'Vermentino (Sardegna, Liguria, Toscana): bianco sapido e profumato.', 'Giallo paglierino chiaro.', 'Agrumi, fiori bianchi, erbe mediterranee, mandorla.', 'Fresco, sapido, finale lievemente amarognolo.', ['Pesce', 'Crostacei', 'Pesto', 'Verdure'], '8–10 °C.', [1, 3]),
  e(['vernaccia'], 'Vernaccia di San Gimignano (Toscana): bianco secco e minerale.', 'Giallo paglierino.', 'Fiori, mela, mandorla, note minerali.', 'Fresco, sapido, finale ammandorlato.', ['Antipasti', 'Pesce', 'Carni bianche'], '8–10 °C.', [1, 4]),
  e(['fiano'], 'Fiano di Avellino (Campania): bianco di struttura e complessità.', 'Giallo paglierino.', 'Nocciola, pera, miele, fiori, note affumicate.', 'Pieno, sapido, lungo.', ['Pesce al forno', 'Crostacei', 'Formaggi di media stagionatura'], '10–12 °C.', [2, 8]),
  e(['greco di tufo', 'greco'], 'Greco di Tufo (Campania): bianco sapido e minerale.', 'Giallo paglierino intenso.', 'Pesca, albicocca, fiori, note minerali.', 'Fresco, sapido, di buon corpo.', ['Pesce', 'Mozzarella di bufala', 'Pasta con le verdure'], '10 °C.', [2, 7]),
  e(['falanghina'], 'Falanghina (Campania): bianco fruttato e fresco.', 'Giallo paglierino.', 'Mela, agrumi, fiori, note di frutta tropicale.', 'Fresco, morbido, finale sapido.', ['Pesce', 'Pizza bianca', 'Antipasti'], '8–10 °C.', [1, 3]),
  e(['gewurztraminer', 'traminer'], 'Gewürztraminer (Alto Adige): bianco aromatico e profumatissimo.', 'Giallo dorato.', 'Rosa, litchi, spezie, zenzero, frutta esotica.', 'Morbido, aromatico, poca acidità, finale speziato.', ['Cucina speziata', 'Formaggi erborinati', 'Foie gras', 'Dolci non troppo zuccherati'], '8–10 °C.', [1, 6]),
  e(['sauvignon'], 'Sauvignon Blanc: bianco aromatico e verde.', 'Giallo paglierino con riflessi verdi.', 'Pompelmo, foglia di pomodoro, erba tagliata, frutto della passione.', 'Fresco, acidità alta, finale sapido.', ['Pesce', 'Asparagi', 'Formaggi di capra', 'Insalate'], '8–10 °C.', [0, 3]),
  e(['chardonnay'], 'Chardonnay: bianco versatile, da fresco e secco a ricco e rotondo se affinato in legno.', 'Giallo paglierino fino al dorato.', 'Mela, agrumi, burro, vaniglia, frutta tropicale.', 'Corpo medio-pieno, morbido, acidità variabile.', ['Pesce al forno', 'Pollo', 'Risotti', 'Formaggi cremosi'], '10–12 °C.', [1, 8]),
  e(['friulano', 'tocai'], 'Friulano (Friuli): bianco secco e sapido.', 'Giallo paglierino.', 'Fieno, mandorla, fiori bianchi, pera.', 'Morbido, sapido, finale di mandorla amara.', ['Prosciutto di San Daniele', 'Pesce', 'Frico'], '10 °C.', [1, 4]),
  e(['ribolla'], 'Ribolla Gialla (Friuli): bianco fresco e sapido; esiste anche in versione spumante o macerata.', 'Giallo paglierino, o ambrato se macerato.', 'Fiori bianchi, agrumi, mela verde.', 'Fresco, acidità alta, sapido.', ['Crudi', 'Pesce', 'Antipasti'], '8–10 °C.', [1, 4]),
  e(['collio'], 'Collio (Friuli): zona di bianchi strutturati e sapidi.', 'Giallo paglierino.', 'Frutta a polpa bianca, fiori, note minerali.', 'Pieno, sapido, buona freschezza.', ['Pesce', 'Prosciutto crudo', 'Formaggi'], '10 °C.', [1, 6]),
  e(['rosato', 'rose', 'rosé', 'cerasuolo', 'chiaretto'], 'Rosato: vino fresco di color rosa.', 'Rosa tenue o cerasuolo intenso.', 'Fragola, ciliegia, fiori, agrumi.', 'Fresco, leggero, fruttato.', ['Aperitivo', 'Pesce', 'Insalate', 'Salumi leggeri'], '8–10 °C.', [0, 2]),
];

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Cerca lo stile nel testo (nome, produttore o testo letto dall'etichetta), a parola intera.
export function findStyle(text) {
  const hay = ' ' + norm(text) + ' ';
  return KB.find((p) => p.keys.some((k) => hay.includes(' ' + norm(k) + ' '))) || null;
}

// Vitigni e denominazioni solo rossi / solo bianchi, per il tipo quando lo stile non è nell'archivio.
const RED = ['ghemme', 'gattinara', 'lacrima', 'malanotte', 'pignolo', 'sagrantino', 'frappato', 'plavac', 'volnay', 'sociando', 'gravello', 'sanfelice', 'megonio', 'schioppettino', 'teroldego', 'lagrein', 'tazzelenghe', 'bruciato'];
const WHITE = ['riesling', 'malvasia', 'rebula', 'picolit', 'verduzzo', 'muller', 'vitovska', 'gavi', 'arneis', 'grillo', 'inzolia', 'catarratto', 'zibibbo', 'glera', 'kerner', 'silvaner'];

// Tipo di vino dedotto dal testo o dallo stile riconosciuto.
export function guessType(text, style) {
  const t = ' ' + norm(text) + ' ';
  if (/ (spumante|brut|metodo classico|franciacorta|prosecco|champagne|extra dry|trento doc|talento|pas dose|dosaggio zero|cremant|cava) /.test(t)) return 'Spumante';
  if (/ (rosato|rose|cerasuolo|chiaretto) /.test(t)) return 'Rosé';
  if (/ (rosso|rouge|red) /.test(t)) return 'Rosso';
  if (/ (bianco|blanc|white) /.test(t)) return 'Bianco';
  const v = style ? style.vista : '';
  if (/^Rosso/.test(v)) return 'Rosso';
  if (/^Giallo/.test(v)) return 'Bianco';
  if (/^Rosa/.test(v)) return 'Rosé';
  if (RED.some((k) => t.includes(' ' + k + ' '))) return 'Rosso';
  if (WHITE.some((k) => t.includes(' ' + k + ' '))) return 'Bianco';
  return '';
}

export function offlineProfile({ name, producer, vintage, text }) {
  const best = findStyle(`${name} ${producer} ${text || ''}`);
  if (!best) return null;
  let maturita = '';
  const y = parseInt(vintage, 10);
  if (y > 1900 && best.eta) {
    const age = new Date().getFullYear() - y;
    maturita = age < best.eta[0] ? `Per questo stile di solito il momento migliore arriva dopo ${best.eta[0]} anni dalla vendemmia: l’annata ${y} può essere ancora giovane.`
      : age <= best.eta[1] ? `L’annata ${y} è in una fase tipicamente buona per questo stile.`
      : `L’annata ${y} è oltre la finestra tipica per questo stile: dipende molto dal produttore e dalla conservazione.`;
  }
  return {
    identita: best.identita, vista: best.vista, naso: best.naso, bocca: best.bocca,
    abbinamenti: best.abbinamenti, servizio: best.servizio, maturita, confidenza: 'media', offline: true,
  };
}
