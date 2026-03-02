<?php

namespace App\Http\Controllers;

use App\Models\Recetas;
use App\Models\Recetas_web;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use App\Http\Controllers\Cereales_servicios_configController;

class Recetas_webController extends Controller
{
    protected $controladorCSC;

    public function __construct(Cereales_servicios_configController $controladorCSC)
    {
        $this->controladorCSC = $controladorCSC;
    } 

    public function crear_desde_receta($id_receta) {
        try {
            $receta_web = Recetas_web::where('idReceta', $id_receta);
            if ($receta_web == null) {
                // Genera un registro en 'recetas_web' asociado a esta receta y 
                // con todos los campos en NULL
                $receta_web = Recetas_web::create([
                    'idReceta' => $id_receta,
                    'fecha_inicio' => null,
                    'fecha_fin' => null,
                    //'tasa_aplicacion' => null,
                    //'recargas' => null,
                    'humedad' => null,
                    'viento_velocidad' => null,
                    'viento_direccion' => null,
                    'rocio' => null,
                    'temperatura' => null,
                    'nublado' => null,
                    'humedad2' => null,
                    'profundidad' => null,
                    'ancho_trabajo' => null,
                    'rastrojo' => null,
                    'observaciones_e' => null,
                    'observaciones_o' => null
                ]);
            }
            return true;
        } catch (Exception $e) {
            Log::error("Ha ocurrido un error inesperado en [Recetas_webController::crear_desde_receta]: ".$e->getMessage());
            return false;
        }
    }


    public function guardar(Request $request) {
        $error_controlado = false;
        try {
            $user = Auth::user();
            if ($user->rol != "E" && $user->rol != "O") {
                $error_controlado <= true;
                throw new Exception("Usuario no autorizado para esta operación");
            }

            $validate = ['id' =>  'required|integer|exists:recetas_web,id'];
            //$validate = ['idReceta' =>  'required|integer|exists:recetas,id'];
            if ($user->rol == "E") {
                $validate['observaciones_e'] = 'nullable|string';
            } else {
                $validate['fecha_inicio'] = 'required|date_format:Y-m-d';
                $validate['fecha_fin'] = 'required|date_format:Y-m-d';
                //$validate['tasa_aplicacion'] = 'required|numeric|min:0';
                //$validate['recargas'] = 'required|integer|min:0';
                $validate['humedad'] = 'required|numeric|min:0';
                $validate['viento_velocidad'] = 'required|numeric|min:0';
                $validate['viento_direccion'] = 'required|string|max:100';
                $validate['rocio'] = 'required|string|min:1|max:1';     // S: Si - N: No
                $validate['temperatura'] = 'required|numeric|min:0';
                $validate['nublado'] = 'required|string|min:1|max:1';   // S: Si - N: No
                $validate['humedad2'] = 'required|string|min:1|max:2';  // B: Buena - MB: Muy Buena - M: Mala
                $validate['profundidad'] = 'required|numeric|min:0';
                $validate['ancho_trabajo'] = 'required|numeric|min:0';
                $validate['rastrojo'] = 'required|string|min:1|max:1';  // M: Mucho - R: RegulaR -P: Poco - N: Nada
                $validate['observaciones_o'] = 'nullable|string';
            }
            $validator = Validator::make($request->all(), $validate);
            if ($validator->fails()) {
                $error_controlado = true;
                return response()->json(['errores'=>$validator->errors()]);
            }

            $id = $request->id;
            $receta_web = Recetas_web::find($id);
            $id_receta = $receta_web->idReceta;   //$request->idReceta;
/*            
            $fecha_inicio = $request->fecha_inicio;
            $fecha_fin = $request->fecha_fin;
            $humedad = $request->humedad;
            $viento_velocidad = $request->viento_velocidad;
            $viento_direccion = $request->viento_direccion;
            $rocio = $request->rocio;
            $temperatura = $request->temperatura;
            $nublado = $request->nublado;
            $observaciones_e = $request->observaciones_e;
            $observaciones_o = $request->observaciones_o;
*/
            $receta = Recetas::find($id_receta);
            if ($receta == null) {
                $error_controlado = true;
                throw new Exception("La receta no existe");
            }
            if ($user->rol == 'E' && ($receta->idEncargado != $user->id || $receta->estado != 3) || 
                $user->rol == 'O' && ($receta->idOperario != $user->id || $receta->estado != 2)) {
                $error_controlado = true;
                throw new Exception("Usuario no autorizado para modificar esta receta.");
            }

            $servicio = $receta->idServicio;

            $array_campos = array();    //['idReceta'] = $id_receta;
            if ($user->rol == "E") {
                $array_campos['observaciones_e'] = $request->observaciones_e === null ? '' : $request->observaciones_e;
            } else {
                $array_campos['fecha_inicio'] = $request->fecha_inicio;
                $array_campos['fecha_fin'] = $request->fecha_fin;
                $array_campos['observaciones_o'] = $request->observaciones_o === null ? '' : $request->observaciones_o;

                $array_campos['humedad'] = $this->tiene_campo_activo($servicio,'humedad') ? $request->humedad : 0;
                $array_campos['viento_velocidad'] = $this->tiene_campo_activo($servicio,'viento_velocidad') ? $request->viento_velocidad : 0;
                $array_campos['viento_direccion'] = $this->tiene_campo_activo($servicio,'viento_direccion') ? $request->viento_direccion : '';
                $array_campos['rocio'] = $this->tiene_campo_activo($servicio,'rocio') ? $request->rocio : '';
                $array_campos['temperatura'] = $this->tiene_campo_activo($servicio,'temperatura') ? $request->temperatura : 0;
                $array_campos['nublado'] = $this->tiene_campo_activo($servicio,'nublado') ? $request->nublado : '';
                $array_campos['humedad2'] = $this->tiene_campo_activo($servicio,'humedad2') ? $request->humedad2 : '';
                $array_campos['profundidad'] = $this->tiene_campo_activo($servicio,'profundidad') ? $request->profundidad : 0;
                $array_campos['ancho_trabajo'] = $this->tiene_campo_activo($servicio,'ancho_trabajo') ? $request->ancho_trabajo : 0;
                $array_campos['rastrojo'] = $this->tiene_campo_activo($servicio,'rastrojo') ? $request->rastrojo : '';
            }

            Recetas_web::where('id', $id)
                    ->update($array_campos);
            return response()
                    ->json([
                        'ok' => true,
                    ]);
        } catch (Exception $e) {
            if (!$error_controlado) {
                Log::error('Ha ocurrido un error inesperado RedcetasController::receta_web_guardar; '.$e->getMessage());
            }
            return response()
                    ->json([
                        'ok' => false,
                        'msg' => $error_controlado ? $e->getMessage() : 'Ha ocurrido un error inesperado'
                    ]);
        }
    }

    public function tiene_campo_activo($servicio, $campo) {
            // Consulta las etiquetas (datos adicionales) activos para el servicio indicado
            $resp = $this->controladorCSC->servicio_tiene_campo_activo($servicio,$campo);
            if (!$resp['ok']) {
                return false;
            }
            return $resp['existe'];
    }
}
