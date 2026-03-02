<?php

namespace App\Http\Controllers;

use App\Models\User;
use Exception;
use Illuminate\Support\Facades\Log;
use Validator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function getUsuarios() {
        try {
            $users = User::all();
            return response()
                ->json([
                    'ok' => true,
                    'data' => $users
                ]);
        } catch (Exception $e) {
            Log::error('Ha ocurrido un error inesperado: '.$e->getMessage());
            return response()
                ->json([
                    'ok' => false,
                    'msg' => 'Ha ocurrido un error inesperado.'
                ]);
        }
    }

    public function register(Request $request) {
        try {
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'rol' => ' '
            ]);

            return response()->json([
                'ok'=> true,
                'user' => $user
            ]);
        }
        catch (Exception $e) {
            Log::error("Ha ocurrido un error inesperado: ".$e->getMessage());
            return response()->json([
                'ok' => false,
                'msg' => "Ha ocurrido un error inesperado"
            ]);
        }
    }

    public function login(Request $request) {
        if (!Auth::attempt($request->only('email','password'))) {
            return response()
                ->json([
                    'ok' => false,
                    'msg' => 'Credenciales incorrectas'
                ], 401);
        }
        
        $user = User::where('email', $request['email'])->first();
        $token = $user->createToken('auth_tocken')->plainTextToken;

        return response()
            ->json([
                'ok' => true,
                'accessToken' =>$token,
                'token_type' => 'Bearer',
                'user' => $user
            ]);
    }

    public function logout() {
        /** @disregard [OPTIONAL_CODE] [OPTIONAL_DESCRIPTION] */
        auth()->user()->tokens()->delete();

        return response()
            ->json([
                'ok' => true,
                'msg' => 'Sesión cerrada correctamente'
            ]);
    }

}
