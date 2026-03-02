<?php

namespace App\Http\Controllers;

use App\Models\Recetas;
use App\Models\Recetas_lotes;
use App\Models\Recetas_lotes_web;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class Recetas_lotes_webController extends Controller
{
    public function guardar(Request $request) {
        $error_controlado = false;
        $transaccion_iniciada = false;
        try {
            $user = Auth::user();
            if ($user->rol != "E" && $user->rol != "O") {
                $error_controlado <= true;
                throw new Exception("Usuario no autorizado para esta operación");
            }

            $validate = [
                'receta_lotes_web' =>  'required|array',
                'receta_lotes_web.*.id' => 'required|numeric|exists:recetas_lotes_web,id'
                //'receta_lotes_web.*.idRecetaLote' => 'required|numeric|exists:recetas_lotes,id'
            ];
            if ($user->rol == "E") {
                $validate['receta_lotes_web.*.hectareas_e'] = 'required|numeric|min:0';
            } else {
                $validate['receta_lotes_web.*.hectareas_o'] = 'required|numeric|min:0';
            }
            $validator = Validator::make($request->all(), $validate);
            if ($validator->fails()) {
                $error_controlado = true;
                return response()->json([
                    'ok' =>false,
                    'errores'=>$validator->errors()
                ]);
            }

            $receta_lotes_web = $request->receta_lotes_web;


            $transaccion_iniciada = true;
            DB::beginTransaction();
            foreach ($receta_lotes_web as $rlw) {
                $id = $rlw['id'];
                $receta_lote_web = Recetas_lotes_web::find($id);
                $id_receta_lote = $receta_lote_web->idRecetaLote;  //$rlw['idRecetaLote'];
                $hectareas_e = null;
                $hectareas_o = null;
                if ($user->rol == "E") {
                    $hectareas_e = $rlw['hectareas_e'];
                }
                if ($user->rol == "O") {
                    $hectareas_o = $rlw['hectareas_o'];
                }
                $receta_lote = Recetas_lotes::find($id_receta_lote);
                if ($receta_lote == null) {
                    $error_controlado = true;
                    throw new Exception("La receta original está incompleta");
                }
                $receta = Recetas::find($receta_lote->idReceta);
                if ($receta == null) {
                    $error_controlado = true;
                    throw new Exception("La receta original no existe");
                }
                if ($user->rol == 'E' && ($receta->idEncargado != $user->id || $receta->estado != 3) || 
                    $user->rol == 'O' && ($receta->idOperario != $user->id || $receta->estado != 2)) {
                    $error_controlado = true;
                    throw new Exception("Usuario no autorizado para modificar esta receta.");
                }

                $array_campos = array();    //$array_campos['idRecetaLote'] = $id_receta_lote;
                if ($user->rol == "E") {

                    $array_campos['hectareas_e'] = $hectareas_e;
                } else {
                    $array_campos['hectareas_o'] = $hectareas_o;
                }
                Recetas_lotes_web::where('id', $id)
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
                Log::error('Ha ocurrido un error inesperado Recetas_lotes_webController::guardar; '.$e->getMessage());
            }
            return response()   
                    ->json([
                        'ok' => false,
                        'msg' => $error_controlado ? $e->getMessage() : 'Ha ocurrido un error inesperado'
                    ]);
        }
    }

}
