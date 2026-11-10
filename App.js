import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Chargement dynamique sécurisé pour éviter tout plantage du bundler
let Audio = null;
if (Platform.OS !== 'web') {
  try {
    Audio = require('expo-av').Audio;
  } catch (e) {
    console.log("Expo AV non chargé", e);
  }
}

export default function App() {
  const [ecranActuel, setEcranActuel] = useState('accueil'); 
  
  // --- ÉTAT DES LISTES DE TÂCHES ---
  const [listes, setListes] = useState([]);
  const [nomNouvelleListe, setNomNouvelleListe] = useState('');
  const [listeActive, setListeActive] = useState(null);
  const [nouvelleTache, setNouvelleTache] = useState('');

  // --- ÉTAT DU MODULE NOTES ---
  const [notes, setNotes] = useState([]);
  const [titreNote, setTitreNote] = useState('');
  const [contenuNote, setContenuNote] = useState('');
  const [noteActive, setNoteActive] = useState(null);

  // --- ÉTAT DU MODULE VOCAUX ---
  const [vocaux, setVocaux] = useState([]);
  const [enregistrement, setEnregistrement] = useState(null);
  const [estEnregistrementEnCours, setEstEnregistrementEnCours] = useState(false);
  const [sonActif, setSonActif] = useState(null);

  // Chargement global au démarrage
  useEffect(() => {
    chargerListes();
    chargerNotes();
    chargerVocaux();

    // Demande des permissions audio au démarrage
    (async () => {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } catch (e) {
        console.log("Erreur permissions audio", e);
      }
    })();
  }, []);

  const chargerListes = async () => {
    try {
      const donnees = await AsyncStorage.getItem('@toolbox_listes_taches');
      if (donnees !== null) setListes(JSON.parse(donnees));
    } catch (e) { console.error(e); }
  };

  const sauvegarderListes = async (nouvellesListes) => {
    setListes(nouvellesListes);
    try {
      await AsyncStorage.setItem('@toolbox_listes_taches', JSON.stringify(nouvellesListes));
    } catch (e) { console.error(e); }
  };

  const chargerNotes = async () => {
    try {
      const donnees = await AsyncStorage.getItem('@toolbox_notes');
      if (donnees !== null) setNotes(JSON.parse(donnees));
    } catch (e) { console.error(e); }
  };

  const sauvegarderNotes = async (nouvellesNotes) => {
    setNotes(nouvellesNotes);
    try {
      await AsyncStorage.setItem('@toolbox_notes', JSON.stringify(nouvellesNotes));
    } catch (e) { console.error(e); }
  };

  // --- CHARGEMENT ET SAUVEGARDE DES VOCAUX ---
  const chargerVocaux = async () => {
    try {
      const donnees = await AsyncStorage.getItem('@toolbox_vocaux');
      if (donnees !== null) setVocaux(JSON.parse(donnees));
    } catch (e) { console.error("Erreur chargement vocaux", e); }
  };

  const sauvegarderVocaux = async (nouveauxVocaux) => {
    setVocaux(nouveauxVocaux);
    try {
      await AsyncStorage.setItem('@toolbox_vocaux', JSON.stringify(nouveauxVocaux));
    } catch (e) { console.error("Erreur sauvegarde vocaux", e); }
  };

  // --- GESTION ENREGISTREMENT AUDIO ---
  const demarrerEnregistrement = async () => {
    try {
      const permission = await Audio.getPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission refusée", "L'accès au micro est nécessaire pour enregistrer un vocal.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setEnregistrement(recording);
      setEstEnregistrementEnCours(true);
    } catch (err) {
      console.error('Échec du démarrage de l’enregistrement', err);
    }
  };

  const arreterEnregistrement = async () => {
    setEstEnregistrementEnCours(false);
    try {
      if (!enregistrement) return;
      await enregistrement.stopAndUnloadAsync();
      const uri = enregistrement.getURI();
      setEnregistrement(null);

      const nouveauVocal = {
        id: Date.now().toString(),
        titre: `Mémo du ${new Date().toLocaleDateString()} à ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
        uri: uri,
      };

      const nouveauxVocaux = [...vocaux, nouveauVocal];
      sauvegarderVocaux(nouveauxVocaux);
    } catch (err) {
      console.error('Échec de l’arrêt de l’enregistrement', err);
    }
  };

  const ecouterVocal = async (uri) => {
    try {
      if (sonActif) {
        await sonActif.stopAsync();
        await sonActif.unloadAsync();
        setSonActif(null);
      }

      const { sound } = await Audio.Sound.createAsync({ uri });
      setSonActif(sound);
      await sound.playAsync();
    } catch (error) {
      console.error("Erreur lors de la lecture du vocal", error);
    }
  };

  const supprimerVocal = async (idVocal) => {
    const nouveauxVocaux = vocaux.filter(v => v.id !== idVocal);
    sauvegarderVocaux(nouveauxVocaux);
  };

  // --- LOGIQUE TÂCHES ---
  const ajouterListe = () => {
    if (nomNouvelleListe.trim() === '') return;
    const nouvellesListes = [...listes, { id: Date.now().toString(), nom: nomNouvelleListe, taches: [] }];
    sauvegarderListes(nouvellesListes);
    setNomNouvelleListe('');
  };

  const supprimerListe = (idListe) => {
    const nouvellesListes = listes.filter(l => l.id !== idListe);
    sauvegarderListes(nouvellesListes);
  };

  const ajouterTacheDansListe = () => {
    if (nouvelleTache.trim() === '' || !listeActive) return;
    const tachesMisesAJour = [...listeActive.taches, { id: Date.now().toString(), texte: nouvelleTache }];
    const listeModifiee = { ...listeActive, taches: tachesMisesAJour };
    setListeActive(listeModifiee);
    const nouvellesListes = listes.map(l => l.id === listeModifiee.id ? listeModifiee : l);
    sauvegarderListes(nouvellesListes);
    setNouvelleTache('');
  };

  const supprimerTacheDeListe = (idTache) => {
    if (!listeActive) return;
    const tachesMisesAJour = listeActive.taches.filter(t => t.id !== idTache);
    const listeModifiee = { ...listeActive, taches: tachesMisesAJour };
    setListeActive(listeModifiee);
    const nouvellesListes = listes.map(l => l.id === listeModifiee.id ? listeModifiee : l);
    sauvegarderListes(nouvellesListes);
  };

  // --- LOGIQUE NOTES ---
  const ajouterNote = () => {
    if (titreNote.trim() === '' && contenuNote.trim() === '') return;
    const nouvellesNotes = [...notes, { id: Date.now().toString(), titre: titreNote || 'Sans titre', contenu: contenuNote }];
    sauvegarderNotes(nouvellesNotes);
    setTitreNote('');
    setContenuNote('');
    setEcranActuel('mes-notes');
  };

  const supprimerNote = (idNote) => {
    const nouvellesNotes = notes.filter(n => n.id !== idNote);
    sauvegarderNotes(nouvellesNotes);
  };


  // ================= ÉCRANS TÂCHES =================
  if (ecranActuel === 'detail-liste' && listeActive) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.boutonRetour} onPress={() => setEcranActuel('mes-listes')}>
          <Text style={styles.boutonRetourTexte}>← Retour aux listes</Text>
        </TouchableOpacity>
        <Text style={styles.titre}>📁 {listeActive.nom}</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nouvelle tâche..."
            placeholderTextColor="#8C7A6B"
            value={nouvelleTache}
            onChangeText={setNouvelleTache}
          />
          <TouchableOpacity style={styles.boutonAction} onPress={ajouterTacheDansListe}>
            <Text style={styles.boutonTexte}>Ajouter</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.liste}>
          {listeActive.taches.map((tache) => (
            <View key={tache.id} style={styles.item}>
              <Text style={styles.itemTexte}>{tache.texte}</Text>
              <TouchableOpacity onPress={() => supprimerTacheDeListe(tache.id)}>
                <Text style={styles.iconeSupprimer}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (ecranActuel === 'mes-listes') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.boutonRetour} onPress={() => setEcranActuel('accueil')}>
          <Text style={styles.boutonRetourTexte}>← Accueil</Text>
        </TouchableOpacity>
        <Text style={styles.titre}>Mes Listes de Tâches 📝</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nom de la nouvelle liste..."
            placeholderTextColor="#8C7A6B"
            value={nomNouvelleListe}
            onChangeText={setNomNouvelleListe}
          />
          <TouchableOpacity style={styles.boutonAction} onPress={ajouterListe}>
            <Text style={styles.boutonTexte}>Créer</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.liste}>
          {listes.map((uneListe) => (
            <View key={uneListe.id} style={styles.itemListe}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => { setListeActive(uneListe); setEcranActuel('detail-liste'); }}>
                <Text style={styles.itemTexte}>📁 {uneListe.nom} ({uneListe.taches.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => supprimerListe(uneListe.id)}>
                <Text style={styles.iconeSupprimer}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }


  // ================= ÉCRANS NOTES =================
  if (ecranActuel === 'mes-notes') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.boutonRetour} onPress={() => setEcranActuel('accueil')}>
          <Text style={styles.boutonRetourTexte}>← Accueil</Text>
        </TouchableOpacity>
        <Text style={styles.titre}>Prise de note 📓</Text>
        <TouchableOpacity style={styles.boutonMenu} onPress={() => setEcranActuel('nouvelle-note')}>
          <Text style={styles.boutonMenuTexte}>+ Créer une nouvelle note</Text>
        </TouchableOpacity>
        <ScrollView style={styles.liste}>
          {notes.map((note) => (
            <View key={note.id} style={styles.itemListe}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => { setNoteActive(note); setEcranActuel('detail-note'); }}>
                <Text style={styles.itemTexte}>📄 {note.titre}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => supprimerNote(note.id)}>
                <Text style={styles.iconeSupprimer}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (ecranActuel === 'nouvelle-note') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.boutonRetour} onPress={() => setEcranActuel('mes-notes')}>
          <Text style={styles.boutonRetourTexte}>← Retour aux notes</Text>
        </TouchableOpacity>
        <Text style={styles.titre}>Nouvelle Note ✍️</Text>
        <TextInput
          style={[styles.input, { marginBottom: 15 }]}
          placeholder="Titre de la note..."
          placeholderTextColor="#8C7A6B"
          value={titreNote}
          onChangeText={setTitreNote}
        />
        <TextInput
          style={[styles.input, { height: 150, textAlignVertical: 'top', marginBottom: 20 }]}
          placeholder="Écris ton contenu ici..."
          placeholderTextColor="#8C7A6B"
          multiline={true}
          value={contenuNote}
          onChangeText={setContenuNote}
        />
        <TouchableOpacity style={[styles.boutonAction, { padding: 15, alignItems: 'center' }]} onPress={ajouterNote}>
          <Text style={styles.boutonTexte}>Enregistrer la note</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (ecranActuel === 'detail-note' && noteActive) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.boutonRetour} onPress={() => setEcranActuel('mes-notes')}>
          <Text style={styles.boutonRetourTexte}>← Retour aux notes</Text>
        </TouchableOpacity>
        <Text style={styles.titre}>📄 {noteActive.titre}</Text>
        <View style={[styles.itemListe, { padding: 20, alignItems: 'flex-start' }]}>
          <Text style={[styles.itemTexte, { lineHeight: 22 }]}>{noteActive.contenu}</Text>
        </View>
      </View>
    );
  }


  // ================= ÉCRAN VOCAUX =================
  if (ecranActuel === 'vocaux') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.boutonRetour} onPress={() => setEcranActuel('accueil')}>
          <Text style={styles.boutonRetourTexte}>← Accueil</Text>
        </TouchableOpacity>
        
        <Text style={styles.titre}>Vocaux 🎙️</Text>

        <TouchableOpacity 
          style={[styles.boutonGrosEnregistrement, estEnregistrementEnCours && styles.boutonEnCours]} 
          onPress={estEnregistrementEnCours ? arreterEnregistrement : demarrerEnregistrement}
        >
          <Text style={styles.boutonGrosTexte}>
            {estEnregistrementEnCours ? "🛑 Arrêter l'enregistrement" : "🔴 Enregistrer un vocal"}
          </Text>
        </TouchableOpacity>

        <ScrollView style={styles.liste}>
          {vocaux.map((vocal) => (
            <View key={vocal.id} style={styles.itemListe}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.itemTexte}>🎙️ {vocal.titre}</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.boutonEcouter} 
                onPress={() => ecouterVocal(vocal.uri)}
              >
                <Text style={styles.boutonEcouterTexte}>▶️ Écouter</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => supprimerVocal(vocal.id)} style={{ marginLeft: 10 }}>
                <Text style={styles.iconeSupprimer}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }


  // ================= MENU ACCUEIL PRINCIPAL =================
  return (
    <View style={styles.container}>
      <Text style={styles.titreMain}>Mon Toolbox 🧰</Text>

      <TouchableOpacity style={styles.boutonMenu} onPress={() => setEcranActuel('mes-listes')}>
        <Text style={styles.boutonMenuTexte}>📝 Mes Listes de Tâches</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.boutonMenu} onPress={() => setEcranActuel('mes-notes')}>
        <Text style={styles.boutonMenuTexte}>📓 Prise de note</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.boutonMenu} onPress={() => setEcranActuel('vocaux')}>
        <Text style={styles.boutonMenuTexte}>🎙️ Vocaux</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, backgroundColor: '#FDFBF7', paddingTop: 60 },
  titreMain: { fontSize: 30, fontWeight: '800', color: '#2C221E', marginBottom: 35, textAlign: 'center', letterSpacing: 0.5 },
  titre: { fontSize: 24, fontWeight: '700', color: '#2C221E', marginBottom: 20 },
  
  boutonMenu: { backgroundColor: '#FFFFFF', padding: 22, borderRadius: 14, marginBottom: 15, borderLeftWidth: 6, borderLeftColor: '#D97706', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  boutonMenuTexte: { color: '#2C221E', fontSize: 18, fontWeight: '600' },
  boutonRetour: { backgroundColor: '#EFECE6', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 20 },
  boutonRetourTexte: { color: '#5C4A3C', fontWeight: '600', fontSize: 14 },
  
  inputContainer: { flexDirection: 'row', marginBottom: 20, width: '100%', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', color: '#2C221E', padding: 15, borderRadius: 10, marginRight: 10, fontSize: 16, borderWidth: 1, borderColor: '#E5E0D8' },
  boutonAction: { backgroundColor: '#D97706', paddingVertical: 15, paddingHorizontal: 18, borderRadius: 10, justifyContent: 'center' },
  boutonTexte: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  
  boutonGrosEnregistrement: { backgroundColor: '#D97706', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  boutonEnCours: { backgroundColor: '#DC2626' },
  boutonGrosTexte: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  
  boutonEcouter: { backgroundColor: '#059669', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  boutonEcouterTexte: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },

  liste: { marginTop: 5 },
  item: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 18, marginBottom: 12, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  itemListe: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 20, marginBottom: 12, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  itemTexte: { color: '#2C221E', fontSize: 16, fontWeight: '500' },
  iconeSupprimer: { fontSize: 16, color: '#9CA3AF', fontWeight: 'bold', padding: 4 }
});