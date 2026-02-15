import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView, 
  Alert 
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { GoogleGenerativeAI } from "@google/generative-ai";
// New SDK 54 FileSystem API
import { File } from 'expo-file-system'; 

// --- CONFIGURATION ---
// IMPORTANT: Replace with your actual Gemini API Key
// Remove the old hardcoded string
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(API_KEY);

export default function App() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [nutritionData, setNutritionData] = useState(null);

  // Request permissions on mount
  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  // --- ANALYZE FUNCTION ---
 const analyzeImage = async (photoPath) => {
    setIsAnalyzing(true);
    try {
      // 1. Fix the URI for Android
      const uri = photoPath.startsWith('file://') ? photoPath : `file://${photoPath}`;
      const file = new File(uri); 
      const base64Image = await file.base64();

      // 2. Use the model that worked for you!
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // 3. Define prompt EXACTLY before use to avoid ReferenceError
      const promptText = `Identify the food. Return ONLY raw JSON. No markdown. 
      Schema: {"food_item": "name", "volume": "1 cup", "calories": 200, "macros": {"protein": "10g", "carbs": "20g", "fats": "5g"}}`;

      const result = await model.generateContent([
        promptText, // Use the variable we just defined
        { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
      ]);

      const response = await result.response;
      let text = response.text();

      // 4. Clean and Parse
      const jsonString = text.replace(/```json|```/g, "").trim(); 
      const parsedData = JSON.parse(jsonString);
      setNutritionData(parsedData);

    } catch (error) {
      console.error("Detailed Error:", error);
      Alert.alert("Analysis Error", error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const takePhoto = async () => {
    if (!camera.current) return;
    try {
      const photo = await camera.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'auto'
      });
      analyzeImage(photo.path);
    } catch (e) {
      console.error("Capture Error:", e);
    }
  };

  // --- RENDERING ---
  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.whiteText}>Camera permission is required.</Text>
        <TouchableOpacity style={styles.closeButton} onPress={requestPermission}>
          <Text style={styles.closeButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) return <View style={styles.center}><Text style={styles.whiteText}>Searching for camera...</Text></View>;

  return (
    <View style={styles.container}>
      {/* Camera Preview */}
      <Camera
        ref={camera}
        key={device?.id} 
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!nutritionData && !isAnalyzing}
        photo={true}
      />

      {/* Capture Button */}
      {!nutritionData && !isAnalyzing && (
        <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
          <View style={styles.innerCircle} />
        </TouchableOpacity>
      )}

      {/* Loading Overlay */}
      {isAnalyzing && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Analyzing Meal...</Text>
        </View>
      )}

      {/* Results Container */}
      {nutritionData && (
        <View style={styles.resultsContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{nutritionData.food_item}</Text>
            <Text style={styles.subtitle}>Estimated: {nutritionData.volume}</Text>
            
            <View style={styles.calCard}>
              <Text style={styles.calText}>{nutritionData.calories}</Text>
              <Text style={styles.calSub}>Total Calories</Text>
            </View>

            <View style={styles.macroRow}>
              <MacroItem label="Protein" value={nutritionData.macros.protein} />
              <MacroItem label="Carbs" value={nutritionData.macros.carbs} />
              <MacroItem label="Fats" value={nutritionData.macros.fats} />
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={() => setNutritionData(null)}>
              <Text style={styles.closeButtonText}>Scan Next Item</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const MacroItem = ({ label, value }) => (
  <View style={styles.macroItem}>
    <Text style={styles.macroValue}>{value}</Text>
    <Text style={styles.macroLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  whiteText: { color: '#fff', marginBottom: 20, fontSize: 16 },
  captureButton: {
    position: 'absolute', bottom: 60, alignSelf: 'center',
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  innerCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 20, fontSize: 18, fontWeight: '600' },
  resultsContainer: {
    position: 'absolute', bottom: 0, width: '100%', height: '55%',
    backgroundColor: '#fff', borderTopLeftRadius: 35, borderTopRightRadius: 35,
    padding: 30, elevation: 25
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111' },
  subtitle: { fontSize: 16, color: '#777', marginBottom: 25 },
  calCard: { backgroundColor: '#F2F8FF', padding: 25, borderRadius: 24, alignItems: 'center', marginBottom: 25 },
  calText: { fontSize: 52, fontWeight: 'bold', color: '#007AFF' },
  calSub: { fontSize: 14, color: '#007AFF', fontWeight: 'bold', letterSpacing: 1 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 35 },
  macroItem: { alignItems: 'center', flex: 1 },
  macroValue: { fontSize: 20, fontWeight: 'bold', color: '#222' },
  macroLabel: { fontSize: 13, color: '#AAA', marginTop: 5 },
  closeButton: { backgroundColor: '#007AFF', padding: 20, borderRadius: 18, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 17 }
});