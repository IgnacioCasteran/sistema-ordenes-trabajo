<?php

namespace App\Http\Controllers;

use App\Models\Recetas;
use App\Models\Recetas_insumos;
use App\Models\Recetas_insumos_web;
use App\Models\Recetas_web;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class Recetas_insumos_webController extends Controller
{
    protected $controladorCSC;

    public function __construct(Cereales_servicios_configController $controladorCSC) {
        $this->controladorCSC = $controladorCSC;
    }

    public function guardar(Request $request) {
        $error_controlado = false;
        $transaccion_iniciada = false;
        try {
            $user = Auth::user();
            if ($user->rol != "E" && $user->rol != "O") {
                $error_controlado = true;
                throw new Exception("Usuario no autorizado para esta operación");
            }

            $id_receta = $request->id_receta;


            $validate = [
                'receta_insumos_web' =>  'array',
                'receta_insumos_web.*.id' => 'required|numeric|exists:recetas_insumos_web,id',
            ];
            if ($user->rol == "E") {
                $validate['receta_insumos_web.*.cantidad_e'] = 'required|numeric|min:0';
            } else {
                $validate['receta_lotes_web.*.cantidad_o'] = 'required|numeric|min:0';
                $validate['tasa_aplicacion'] = 'required|numeric|min:0';
                $validate['recargas'] = 'required|integer|min:0';
                $validate['id_receta'] = 'required|integer|exists:recetas,id';
            }
            $validator = Validator::make($request->all(), $validate);
            if ($validator->fails()) {
                $error_controlado = true;
                return response()->json([
                    'ok' =>false,
                    'errores'=>$validator->errors()
                ]);
            }

            $id_receta = $request->id_receta;
            $receta_insumos_web = $request->receta_insumos_web;
            $receta = Recetas::where('id', $id_receta)->first();
            // aca no valido que exista la receta porque esa validación se hace en el Validator
            $servicio = $receta->idServicio;

            $transaccion_iniciada = true;
            // Comenzar transacción
            DB::beginTransaction();

            if ($user->rol === 'O') {
                $tasa_aplicacion = $request->tasa_aplicacion;
                $recargas = $request->recargas;
                Recetas_web::where('idReceta', $id_receta)
                            ->update([
                                'tasa_aplicacion' => $this->tiene_campo_activo($servicio,'tasa_aplicacion') ? $tasa_aplicacion : 0,
                                'recargas' => $this->tiene_campo_activo($servicio,'recargas') ? $recargas : 0
                            ]);
            }
            foreach ($receta_insumos_web as $riw) {
                $id = $riw['id'];
                $receta_insumo_web = Recetas_insumos_web::find($id);
                $id_receta_insumo = $receta_insumo_web->idRecetaInsumo; //$riw['idRecetaInsumo'];
                $cantidad_e = null;
                $cantidad_o = null;
                if ($user->rol == "E") {
                    $cantidad_e = $riw['cantidad_e'];
                }
                if ($user->rol == "O") {
                    $cantidad_o = $riw['cantidad_o'];
                }
                $receta_insumo = Recetas_insumos::find($id_receta_insumo);
                if ($receta_insumo == null) {
                    $error_controlado = true;
                    throw new Exception("La receta original está incompleta");
                }
                $receta = Recetas::find($receta_insumo->idReceta);
                if ($receta == null) {
                    $error_controlado = true;
                    throw new Exception("La receta original no existe");
                }
/*
                return response()->json([
                    '$user->rol' => $user->rol,
                    '$receta->idOperario'=>$receta->idOperario,
                    '$user->id'=>$user->id,
                    '$receta->estado' => $receta->estado
                ]);
*/

                if ($user->rol == 'E' && ($receta->idEncargado != $user->id || $receta->estado != 3) || 
                    $user->rol == 'O' && ($receta->idOperario != $user->id || $receta->estado != 2)) {
                    $error_controlado = true;
                    throw new Exception("Usuario no autorizado para modificar esta receta.");
                }

                $array_campos = []; //['idRecetaInsumo'] = $id_receta_insumo;
                if ($user->rol == "E") {
                    $array_campos['cantidad_e'] = $cantidad_e;
                } else {
                    $array_campos['cantidad_o'] = $cantidad_o;
                }
                Recetas_insumos_web::where('id', $id)
                        ->update($array_campos);
            }
            DB::commit();

            return response()
                    ->json([
                        'ok' => true,
                    ]);
        } catch (Exception $e) {
            if ($transaccion_iniciada) {
                DB::rollBack();
            }

            if (!$error_controlado) {
                Log::error('Ha ocurrido un error inesperado Recetas_insumos_webController::guardar; '.$e->getMessage());
            }
            return response()
                    ->json([
                        'ok' => false,
                        'msg' => $error_controlado ? $e->getMessage() : 'Ha ocurrido un error inesperado'.$e->getMessage()
                    ]);
        }
    }

    public function tiene_campo_activo($servicio, $campo) {
            // COnsulta las etiquetas (datos adicionales) activos para el servicio indicado
            $resp = $this->controladorCSC->servicio_tiene_campo_activo($servicio,$campo);
            if (!$resp['ok']) {
                return false;
            }
            return $resp['existe'];
    }

}
