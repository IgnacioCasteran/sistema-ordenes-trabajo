<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use App\Models\User;
use Exception;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use App\Models\Recetas;
use App\Models\Recetas_insumos;
use App\Models\Recetas_insumos_web;
use App\Models\Recetas_lotes;
use App\Models\Recetas_lotes_web;
use App\Models\Recetas_web;
use Illuminate\Support\Facades\Validator;

class RecetasController extends Controller
{

    public function index () {
        try {
            $recetas = Recetas::all();
            return response()->json([
                'ok' => true,
                'data' => $recetas
            ], 200);
        } catch (Exception $e) {
            Log::error('Ha ocurrido un error inesperado; '.$e->getMessage()());
            return response()->json([
                'ok' => false,
                'msg' => 'Ha ocurrido un error inesperado.'
            ], 500);
        }
    }

    public function recetas_pendientes() {
        // Obtiene las recetas pendientes para el Encargado u Operario autenticado
        try {
            $user = Auth::user();   // Obtiene el usuario autenticado.
            if (! in_array($user->rol, ['E','O'])) {
                // EL usuario no es ni Encargado ni Operario
                return response()
                        ->json([
                            'ok' => false,
                            'msg' => 'Acceso restringido para este usuario.'
                        ]);
            }

            $recetas = DB::table("recetas")
                        ->join('recetas_lotes','recetas.id','=','recetas_lotes.idReceta')
                        ->join('cereales_rotacion_lotes','recetas_lotes.idRotacionLote','=','cereales_rotacion_lotes.id')
                        ->join('cereales_rotacion','cereales_rotacion_lotes.idRotacion','=','cereales_rotacion.id')
                        ->join('cereales_campos_lotes','cereales_rotacion.idLote','=','cereales_campos_lotes.id')
                        ->join('cereales_campos','cereales_campos_lotes.idCampo','=','cereales_campos.id')
                        ->join('tablas', function ($join) {
                            $join->on('recetas.idServicio','=','tablas.codigo')
                                ->where('tablas.tipo','=','A');
                        })
                        ->where(function ($query) use ($user) {
                            $query->where('recetas.idEncargado', $user->id)
                                ->whereIn('recetas.estado',[1,2,3]);
                        })
                        ->orWhere(function ($query) use ($user) {
                            $query->where('recetas.idOperario', $user->id)
                                ->where('recetas.estado', 2);
                        })
                        ->select(
                            DB::raw('recetas.*'),
                            'cereales_campos.nombre AS campo',
                            'tablas.nombre AS servicio'
                        )
                        ->distinct()
                        ->orderBy('recetas.fecha','asc')->orderBy('recetas.id','asc')
                        ->get();

            return response()
                    ->json([
                        'ok' => true,
                        'data' => $recetas
                    ]);
        } catch (Exception $e) {
            Log::error('Ha ocurrido un error inesperado: '.$e->getMessage());
            return response()
                    ->json([
                        'ok' => false,
                        'msg' => 'Ha ocurrido un error inesperado'
                    ]);
        }
    }

    public function obtenerReceta ($id) {
        $error_controlado = false;
        try {
            $user = Auth::user();

            $receta = DB::table("recetas")
                        ->join('recetas_lotes','recetas.id','=','recetas_lotes.idReceta')
                        ->join('cereales_rotacion_lotes','recetas_lotes.idRotacionLote','=','cereales_rotacion_lotes.id')
                        ->join('cereales_rotacion','cereales_rotacion_lotes.idRotacion','=','cereales_rotacion.id')
                        ->join('cereales_campos_lotes','cereales_rotacion.idLote','=','cereales_campos_lotes.id')
                        ->join('cereales_campos','cereales_campos_lotes.idCampo','=','cereales_campos.id')
                        ->join('tablas', function ($join) {
                            $join->on('recetas.idServicio','=','tablas.codigo')
                                ->where('tablas.tipo','=','A');
                        })
                        ->where('recetas.id', $id)
                        ->select(
                            DB::raw('recetas.*'),
                            'cereales_campos.nombre AS campo',
                            'tablas.nombre AS servicio',
                        )
                        ->first();

            if ($user->rol == "E" && ($receta->idEncargado != $user->id || ! in_array($receta->estado, [1,2,3])) ||
                $user->rol == "O" && ($receta->idOperario != $user->id || $receta->estado != 2)) 
            {
                // Solo puede ver esta receta el usuario que la tenga asignada y si está en el estado correspondiente (de acuerdo a su rol)
                $error_controlado = true;
                throw new Exception("Usuario no habilitado para ver esta receta.");
            }

            $receta_lotes = DB::table('recetas_lotes')
                    ->join('cereales_rotacion_lotes','recetas_lotes.idRotacionLote','=','cereales_rotacion_lotes.id')
                    ->join('cereales_rotacion','cereales_rotacion_lotes.idRotacion','=','cereales_rotacion.id')
                    ->join('cereales_campos_lotes','cereales_rotacion.idLote','=','cereales_campos_lotes.id')
                    ->join('cereales_campos','cereales_campos_lotes.idCampo','=','cereales_campos.id')
                    ->join('cereales_cultivos','cereales_rotacion_lotes.idCultivo','=','cereales_cultivos.id')
                    ->join('tablas', function ($join) {
                        $join->on('cereales_cultivos.idCereal','=','tablas.codigo')
                            ->where('tablas.tipo','=','L');
                    })
                    ->where('recetas_lotes.idReceta', $id)
                    ->select(
                        DB::raw("recetas_lotes.*"),
                        'cereales_campos_lotes.nombre AS lote',
                        DB::raw("CAST(CONCAT(TRIM(tablas.nombre),' (',cereales_cultivos.tipo,IF(cereales_cultivos.tipo = 1, 'ra','da'),')') as CHAR) as cultivo"),
                        'recetas_lotes.observaciones',
                        'cereales_rotacion_lotes.hectareas as hectareas_estimadas',
                    )
                    ->get();

            $receta_insumos = DB::table("recetas_insumos")
                        ->join('articulos','recetas_insumos.idInsumo','=','articulos.articulo')
                        ->where('recetas_insumos.idReceta', $id)
                        ->select(
                            DB::raw('recetas_insumos.*'),
                            'articulos.denominacion as nombre_insumo',
                            'articulos.medida',
                        )
                        ->get();
            
            $receta_web = Recetas_web::where('idReceta', $id)->first();
            $receta_lotes_web = DB::table('recetas_lotes_web')
                            ->join('recetas_lotes', 'recetas_lotes_web.idRecetaLote','=','recetas_lotes.id')
                            ->where('recetas_lotes.idReceta',$id)
                            ->select(DB::raw('recetas_lotes_web.*'))
                            ->get();

            $receta_insumos_web = DB::table('recetas_insumos_web')
                            ->join('recetas_insumos', 'recetas_insumos_web.idRecetaInsumo','=','recetas_insumos.id')
                            ->where('recetas_insumos.idReceta',$id)
                            ->select(DB::raw('recetas_insumos_web.*'))
                            ->get();

            return response()->json([
                'ok' => true,
                'data' => [
                    'receta' => $receta,
                    'receta_web' => $receta_web,
                    'receta_lotes' => $receta_lotes,
                    'receta_lotes_web' => $receta_lotes_web,
                    'receta_insumos' => $receta_insumos,
                    'receta_insumos_web' => $receta_insumos_web
                ]
            ],200);
        } catch (Exception $e) {
            if (!$error_controlado) {
                Log::error("Ha ocurrido un error inesperado: ".$e->getMessage());
            }
            return response()
                ->json([
                    'ok' => false,
                    'msg' => $error_controlado ? $e->getMessage() : 'Ha ocurrido un error inesperado'
                ]);
        }
    }


    public function asignar_operario(Request $request) {
        $error_controlado = false;
        $transaccion_iniciada = false;
        $msg = "";
        try {
            $id_receta = $request->id_receta;
            $id_operario = $request->id_operario;

            $user = Auth::user();   // Obtiene el usuario autenticado.

            $operario = User::find($id_operario);
            if ($operario == null) {
                $error_controlado = true;
                throw new Exception('El operario no existe');
            }
            if ($operario->rol != 'O') {
                $error_controlado = true;
                throw new Exception('El operario indicado no tiene la clasificación de Operario.');
            }


            $receta = Recetas::find($id_receta);
            if ($receta == null) {
                $error_controlado = true;
                throw new Exception('La receta no existe');
            }
            if ($receta->idEncargado != $user->id ) {
                $error_controlado = true;
                throw new Exception('La receta no existe dentro de la lista de pendientes');
            }
            if ($receta->idOperario != null || $receta->estado != 1) {
                $error_controlado = true;
                throw new Exception('Esta receta no puede ser asignada a un operario.');
            }

            $transaccion_iniciada = true;
            DB::beginTransaction();
            Recetas::where('id', $id_receta)
                    ->update([
                        'idOperario' => $id_operario,
                        'estado' => 2
            ]);

            $ok = $this->receta_web_crear($id_receta);
            if (!$ok) {
                DB::rollBack();
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
            $msg = "Ha ocurrido un error inesperado";
            if ($error_controlado) {
                $msg = $e->getMessage();
            } else {
                Log::error($msg.": ".$e->getMessage());
            }
            return response()
                ->json([
                    'ok' => false,
                    'msg' => $msg
                ]);
        }

    }


    public function cancelar_asignar_operario(Request $request) {
        $transaccion_iniciada = false;
        $error_controlado = false;
        try {
            $user = Auth::user();   // Obtiene el usuario autenticado.
            $id_receta = $request->id_receta;
            $receta = Recetas::find($id_receta);
            if ($receta == null) {
                $error_controlado = true;
                throw new Exception('La receta indicada no existe.');
            }
            if ($receta->idEncargado != $user->id) {
                $error_controlado = true;
                throw new Exception('Usuario no autorizado para cambiar el estado de esta receta.');
            }
            if ($receta->estado != 2) {
                $error_controlado = true;
                throw new Exception('El estado actual de la receta imposibilita realizar esta operación.');
            }

            $transaccion_iniciada = true;
            DB::beginTransaction();
            Recetas::where('id', $id_receta)
                    ->update([
                        'idOperario' => null,
                        'estado' => 1
            ]);

            Recetas_web::where('idReceta', $id_receta)->delete();

            $recetas_lotes = Recetas_lotes::where('idReceta', $id_receta)->get();
            foreach ($recetas_lotes as $receta_lote) {
                $id_receta_lote = $receta_lote->id;
                Recetas_lotes_web::where('idRecetaLote', $id_receta_lote)->delete();
            }
            $recetas_insumos = Recetas_insumos::where('idReceta', $id_receta)->get();
            foreach ($recetas_insumos as $receta_insumo) {
                $id_receta_insumo = $receta_insumo->id;
                Recetas_insumos_web::where('idRecetaInsumo', $id_receta_insumo)->delete();
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
                Log::error("Ha ocurrido un error inesperado en RecetasController::cancelar_asignacion_operario: ".$e->getMessage());
            }
            return response()
                ->json([
                    'ok' => false,
                    'msg' => $error_controlado ? $e->getMessage() : 'Ha ocurrido un error inesperado.'
                ]);
        }
    }



    public function enviar_a_encargado(Request $request) {
        $error_controlado = false;
        try {
            $user = Auth::user();
            if ($user->rol != 'O') {
                throw new Exception('EL usuario autenticado no es un operario');
            }
            $validator = Validator::make($request->all(),[
                'id' => 'required|integer|exists:recetas,id',
            ]);

            if ($validator->fails()) {
                $error_controlado = true;
                return response()->json(['errores'=>$validator->errors()]);
            }

            $id = $request->id;
            $receta = Recetas::find($id);
            if ($user->id != $receta->idOperario) {
                $error_controlado = true;
                throw new Exception("Esta receta no está asignada al usuario autenticado");
            }
            if ($receta->estado != 2) {
                $error_controlado = true;
                throw new Exception("Esta receta no puede ser enviada al encargado porque ya no está en poder de este operario");
            }

            if (!$this->receta_completa_operario($id)) {
                $error_controlado = true;
                throw new Exception("Esta receta no está completa.");
            }

            Recetas::where('id', $id)
                    ->update(['estado' => 3]);

            return response()
                ->json([
                    'ok' => true
                ]);
        }
        catch (Exception $e) {
            if (!$error_controlado) {
                Log::error("Ha ocurrido un error inesperado en RecetasController::enviar_a_encargado: ".$e->getMessage());
            }
            return response()
                ->json([
                    'ok' => false,
                    'msg' => $error_controlado ? $e->getMessage() : "Ha ocurrido un error inesperado"
                ]);
        }
    }

    public function devolver_a_operario(Request $request) {
        $error_controlado = false;
        try {
            $user = Auth::user();
            if ($user->rol != 'E') {
                throw new Exception('EL usuario autenticado no es un encargado');
            }
            $validator = Validator::make($request->all(),[
                'id' => 'required|integer|exists:recetas,id',
            ]);

            if ($validator->fails()) {
                $error_controlado = true;
                return response()->json(['errores'=>$validator->errors()]);
            }

            $id = $request->id;
            $receta = Recetas::find($id);
            if ($user->id != $receta->idEncargado) {
                $error_controlado = true;
                throw new Exception("Esta receta no está asignada al usuario autenticado");
            }
            if ($receta->estado != 3) {
                $error_controlado = true;
                throw new Exception("Esta receta no puede ser devuelta al operario.");
            }

            Recetas::where('id', $id)
                    ->update(['estado' => 2]);

            return response()
                ->json([
                    'ok' => true
                ]);


        } catch (Exception $e) {
            if (!$error_controlado) {
                Log::error("Error inesperado en RecetasController::devolver_a_operario: ".$e->getMessage());
            }
            return response()
                ->json([
                    'ok' => false,
                    'msg' => $error_controlado ? $e->getMessage() : 'Ha ocurrido un error inesperado'
                ]);
        }
    }

    public function enviar_a_sigecom(Request $request) {
        $error_controlado = false;
        try {
            $user = Auth::user();
            if ($user->rol != 'E') {
                throw new Exception('EL usuario autenticado no es un encargado');
            }
            $validator = Validator::make($request->all(),[
                'id' => 'required|integer|exists:recetas,id',
            ]);

            if ($validator->fails()) {
                $error_controlado = true;
                return response()->json(['errores'=>$validator->errors()]);
            }

            $id = $request->id;
            $receta = Recetas::find($id);
            if ($user->id != $receta->idEncargado) {
                $error_controlado = true;
                throw new Exception("Esta receta no está asignada al usuario autenticado");
            }
            if ($receta->estado != 3) {
                $error_controlado = true;
                throw new Exception("Esta receta no puede ser confirmada por el encargado");
            }

            if (!$this->receta_completa_encargado($id)) {
                $error_controlado = true;
                throw new Exception("Esta receta no está completa.");
            }

            Recetas::where('id', $id)
                    ->update(['estado' => 4]);

            return response()
                ->json([
                    'ok' => true
                ]);
        }
        catch (Exception $e) {
            if (!$error_controlado) {
                Log::error("Ha ocurrido un error inesperado en RecetasController::enviar_a_sigecom: ".$e->getMessage());
            }
            return response()
                ->json([
                    'ok' => false,
                    'msg' => $error_controlado ? $e->getMessage() : "Ha ocurrido un error inesperado"
                ]);
        }
    }


    public function receta_web_crear($id_receta) {
        try {
            $receta_web = Recetas_web::where('idReceta', $id_receta)->first();
            if ($receta_web == null) {
                // Genera un registro en 'recetas_web' asociado a esta receta y 
                // con todos los campos en NULL
                $receta_web = Recetas_web::create([
                    'idReceta' => $id_receta,
                    'fecha_inicio' => null,
                    'fecha_fin' => null,
                    'tasa_aplicacion' => null,
                    'recargas' => null,
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

            $receta_lotes = DB::table('recetas_lotes')
                                ->where('idReceta', $id_receta)
                                ->get();

            foreach ($receta_lotes as $lote) {
                $receta_lote_web = Recetas_lotes_web::where('idRecetaLote', $lote->id)->first();
                if ($receta_lote_web == null) {
                    $receta_lote_web = Recetas_lotes_web::create([
                        'idRecetaLote' => $lote->id,
                        'hectareas_e' => null,
                        'hectareas_o' => null,
                    ]);
                }
            }

            $receta_insumos = DB::table('recetas_insumos')
                                ->where('idReceta', $id_receta)
                                ->get();
                                
            foreach ($receta_insumos as $insumo) {
                $receta_insumo_web = Recetas_insumos_web::where('idRecetaInsumo', $insumo->id)->first();
                if ($receta_insumo_web == null) {
                    $receta_insumo_web = Recetas_insumos_web::create([
                        'idRecetaInsumo' => $insumo->id,
                        'cantidad_e' => null,
                        'cantidad_o' => null,
                    ]);
                }
            }

            return true;
        } catch (Exception $e) {
            Log::error("Ha ocurrido un error inesperado en [Recetas_webController::crear_desde_receta]: ".$e->getMessage());
            return false;
        }
    }

    private function receta_completa_operario($id_receta) {
        try {
            $receta_web = Recetas_web::where('idReceta',$id_receta)->first();
            $ok = $receta_web->fecha_inicio !== null && $receta_web->fecha_fin !== null && $receta_web->tasa_aplicacion !== null &&
                  $receta_web->recargas !== null && $receta_web->humedad !==  null && $receta_web->viento_velocidad !== null &&
                  $receta_web->viento_direccion !== null && $receta_web->rocio !== null && $receta_web->temperatura !== null &&
                  $receta_web->nublado !== null; //&& $receta_web->observaciones_o !== null;
            if ($ok) {
                $ok = DB::table('recetas_lotes_web')
                                ->join('recetas_lotes', 'recetas_lotes_web.idRecetaLote','=','recetas_lotes.id')
                                ->where('recetas_lotes.idReceta',$id_receta)
                                ->where('recetas_lotes_web.hectareas_o',null)
                                ->select(DB::raw('recetas_lotes_web.*'))
                                ->get()->count() == 0;
                if ($ok) {
                    $ok = DB::table('recetas_insumos_web')
                                    ->join('recetas_insumos', 'recetas_insumos_web.idRecetaInsumo','=','recetas_insumos.id')
                                    ->where('recetas_insumos.idReceta',$id_receta)
                                    ->where('recetas_insumos_web.cantidad_o',null)
                                    ->select(DB::raw('recetas_insumos_web.*'))
                                    ->get()->count() == 0;
                }
            }
            return $ok;
        }
        catch (Exception $e) {
            Log::error($e->getMessage());
            return false;
        }
    }

    private function receta_completa_encargado($id_receta) {
        try {
            //$receta_web = Recetas_web::where('idReceta',$id_receta)->first();
            //$ok = $receta_web->observaciones_e !== null;
            $ok = true;
            if ($ok) {
                $ok = DB::table('recetas_lotes_web')
                                ->join('recetas_lotes', 'recetas_lotes_web.idRecetaLote','=','recetas_lotes.id')
                                ->where('recetas_lotes.idReceta',$id_receta)
                                ->where('recetas_lotes_web.hectareas_e',null)
                                ->select(DB::raw('recetas_lotes_web.*'))
                                ->get()->count() == 0;
                if ($ok) {
                    $ok = DB::table('recetas_insumos_web')
                                    ->join('recetas_insumos', 'recetas_insumos_web.idRecetaInsumo','=','recetas_insumos.id')
                                    ->where('recetas_insumos.idReceta',$id_receta)
                                    ->where('recetas_insumos_web.cantidad_e',null)
                                    ->select(DB::raw('recetas_insumos_web.*'))
                                    ->get()->count() == 0;
                }
            }
            return $ok;
        }
        catch (Exception $e) {
            Log::error($e->getMessage());
            return false;
        }
    }
}

